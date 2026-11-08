/* ==========================================================================
   FORMULO · grafik ve simülasyon labı (formulo/assets/formulo-lab.js), 08.11.2026
   11 lab: turev, riemann, taylor, atis, sarkac, alan, rc, matris, yon, normal, newton.
   Her lab FOLAB[id](host, dil) → { dur() }. Mavi kopya üstüne beyaz tebeşir çizer.
   Kontroller kaydırıcıdır; tuval sürüklenebilir noktalar taşır (fare ve dokunma).
   Hareket azaltılınca sürekli animasyon yerine tek kare çizilir.
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document;
  var SAKIN = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var RENK = { zemin: '#183A30', izgara: 'rgba(190,225,255,.10)', izgara2: 'rgba(190,225,255,.22)', eksen: 'rgba(234,244,255,.55)', tebesir: '#EAF4FF', soluk: '#9EC3E8', sari: '#FFD86B', cam: '#7FE3FF', tur: '#FF9F5A', pembe: '#F7A8E0', yesil: '#9BF0C0' };
  var YAZI = { tr: {}, en: {} };
  function T(dil, tr, en) { return dil === 'en' ? en : tr; }
  function fmt(n, dil, d) {
    if (!isFinite(n)) return '—';
    var s = Math.abs(n) >= 1e5 || (Math.abs(n) < 1e-3 && n !== 0) ? n.toExponential(2) : (+n.toFixed(d == null ? 3 : d)).toString();
    return dil === 'en' ? s : s.replace('.', ',');
  }
  /* erf yaklaşıklığı (Abramowitz-Stegun 7.1.26) */
  function erf(x) { var s = x < 0 ? -1 : 1; x = Math.abs(x); var t = 1 / (1 + 0.3275911 * x); var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }
  function Phi(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }

  /* ---------- ortak iskelet: tuval + kontroller + okuma ---------- */
  function iskelet(host, dil, ayar) {
    host.innerHTML = '';
    var kap = D.createElement('div'); kap.className = 'lb';
    var cv = D.createElement('canvas'); cv.className = 'lb-cv'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', ayar.aria || '');
    var oku = D.createElement('div'); oku.className = 'lb-oku'; oku.setAttribute('aria-live', 'polite');
    var kont = D.createElement('div'); kont.className = 'lb-kont';
    kap.appendChild(cv); kap.appendChild(oku); kap.appendChild(kont); host.appendChild(kap);
    var ctx = cv.getContext('2d'), w = 0, h = 0, dpr = 1;
    function boyut() { var r = cv.getBoundingClientRect(); dpr = Math.min(2, W.devicePixelRatio || 1); w = r.width; h = r.height; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    var S = { cv: cv, ctx: ctx, oku: oku, kont: kont, get w() { return w; }, get h() { return h; }, boyut: boyut, dil: dil };
    /* dünya → ekran dönüşümü */
    S.kutu = function (x0, x1, y0, y1, pad) {
      pad = pad == null ? 28 : pad;
      S.X = function (x) { return pad + (x - x0) / (x1 - x0) * (w - 2 * pad); };
      S.Y = function (y) { return h - pad - (y - y0) / (y1 - y0) * (h - 2 * pad); };
      S.iX = function (px) { return x0 + (px - pad) / (w - 2 * pad) * (x1 - x0); };
      S.iY = function (py) { return y0 + (h - pad - py) / (h - 2 * pad) * (y1 - y0); };
      S.sinir = [x0, x1, y0, y1];
    };
    S.zemin = function (eksenler) {
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = RENK.zemin; ctx.fillRect(0, 0, w, h);
      ctx.lineWidth = 1;
      for (var gx = 0; gx < w; gx += 16) { ctx.strokeStyle = gx % 80 === 0 ? RENK.izgara2 : RENK.izgara; ctx.beginPath(); ctx.moveTo(gx + .5, 0); ctx.lineTo(gx + .5, h); ctx.stroke(); }
      for (var gy = 0; gy < h; gy += 16) { ctx.strokeStyle = gy % 80 === 0 ? RENK.izgara2 : RENK.izgara; ctx.beginPath(); ctx.moveTo(0, gy + .5); ctx.lineTo(w, gy + .5); ctx.stroke(); }
      if (eksenler && S.X) {
        var b = S.sinir; ctx.strokeStyle = RENK.eksen; ctx.lineWidth = 1.4;
        if (b[2] <= 0 && b[3] >= 0) { ctx.beginPath(); ctx.moveTo(0, S.Y(0)); ctx.lineTo(w, S.Y(0)); ctx.stroke(); }
        if (b[0] <= 0 && b[1] >= 0) { ctx.beginPath(); ctx.moveTo(S.X(0), 0); ctx.lineTo(S.X(0), h); ctx.stroke(); }
        ctx.fillStyle = RENK.soluk; ctx.font = '500 10px "JetBrains Mono", monospace';
        var adim = function (a, b2) { var r = (b2 - a) / 8, p = Math.pow(10, Math.floor(Math.log10(r))), m = r / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
        var sx = adim(b[0], b[1]), sy = adim(b[2], b[3]), y0 = Math.min(h - 14, Math.max(12, S.Y(0) + 13)), x0 = Math.min(w - 30, Math.max(4, S.X(0) + 4));
        for (var tx = Math.ceil(b[0] / sx) * sx; tx <= b[1]; tx += sx) if (Math.abs(tx) > 1e-9) ctx.fillText(+tx.toFixed(4), S.X(tx) - 6, y0);
        for (var ty = Math.ceil(b[2] / sy) * sy; ty <= b[3]; ty += sy) if (Math.abs(ty) > 1e-9) ctx.fillText(+ty.toFixed(4), x0, S.Y(ty) + 3);
      }
    };
    S.egri = function (fn, renk, kal, x0, x1, kesik) {
      x0 = x0 == null ? S.sinir[0] : x0; x1 = x1 == null ? S.sinir[1] : x1;
      ctx.strokeStyle = renk; ctx.lineWidth = kal || 2.2; ctx.setLineDash(kesik || []); ctx.beginPath();
      var on = false, N = Math.max(80, Math.round(w));
      for (var i = 0; i <= N; i++) {
        var x = x0 + (x1 - x0) * i / N, y = fn(x);
        if (!isFinite(y) || y > S.sinir[3] + 50 * (S.sinir[3] - S.sinir[2]) || y < S.sinir[2] - 50 * (S.sinir[3] - S.sinir[2])) { on = false; continue; }
        if (!on) { ctx.moveTo(S.X(x), S.Y(y)); on = true; } else ctx.lineTo(S.X(x), S.Y(y));
      }
      ctx.stroke(); ctx.setLineDash([]);
    };
    S.nokta = function (x, y, r, renk, halka) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = renk; ctx.fill(); if (halka) { ctx.strokeStyle = RENK.tebesir; ctx.lineWidth = 2; ctx.stroke(); } };
    S.yazi = function (s, x, y, renk, boy, hiza) { ctx.fillStyle = renk || RENK.tebesir; ctx.font = (boy || 13) + 'px "JetBrains Mono", monospace'; ctx.textAlign = hiza || 'left'; ctx.fillText(s, x, y); ctx.textAlign = 'left'; };
    S.ok = function (x0, y0, x1, y1, renk, kal) {
      ctx.strokeStyle = ctx.fillStyle = renk; ctx.lineWidth = kal || 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      var a = Math.atan2(y1 - y0, x1 - x0), L = 8; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - L * Math.cos(a - .4), y1 - L * Math.sin(a - .4)); ctx.lineTo(x1 - L * Math.cos(a + .4), y1 - L * Math.sin(a + .4)); ctx.closePath(); ctx.fill();
    };
    /* kaydırıcı */
    S.kay = function (ad, min, max, st, val, birim, cb) {
      var l = D.createElement('label'); l.className = 'lb-k';
      l.innerHTML = '<span class="lb-ad">' + ad + '</span><input type="range" min="' + min + '" max="' + max + '" step="' + st + '" value="' + val + '"><output></output>';
      var r = l.querySelector('input'), o = l.querySelector('output');
      var yaz = function () { o.textContent = fmt(+r.value, dil, st < 0.01 ? 4 : st < 1 ? 2 : 0) + (birim ? ' ' + birim : ''); };
      r.addEventListener('input', function () { yaz(); cb(+r.value); }); yaz(); kont.appendChild(l);
      return { el: r, set: function (v) { r.value = v; yaz(); } };
    };
    S.sec = function (secenek, val, cb) {
      var g = D.createElement('div'); g.className = 'lb-sec'; g.setAttribute('role', 'group');
      secenek.forEach(function (s) {
        var b = D.createElement('button'); b.type = 'button'; b.innerHTML = s[1]; b.setAttribute('aria-pressed', s[0] === val ? 'true' : 'false');
        b.addEventListener('click', function () { g.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); b.setAttribute('aria-pressed', 'true'); cb(s[0]); });
        g.appendChild(b);
      });
      kont.appendChild(g); return g;
    };
    S.dugme = function (ad, cb) { var b = D.createElement('button'); b.type = 'button'; b.className = 'lb-dug'; b.innerHTML = ad; b.addEventListener('click', cb); kont.appendChild(b); return b; };
    /* sürükleme */
    S.surukle = function (bas, tasi) {
      var aktif = false;
      var nok = function (e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      cv.addEventListener('pointerdown', function (e) { var p = nok(e); if (bas(p)) { aktif = true; cv.setPointerCapture(e.pointerId); e.preventDefault(); } });
      cv.addEventListener('pointermove', function (e) { if (aktif) tasi(nok(e)); });
      var bit = function () { aktif = false; }; cv.addEventListener('pointerup', bit); cv.addEventListener('pointercancel', bit);
      cv.style.touchAction = 'none';
    };
    /* döngü: görünürken çalışır */
    var raf = 0, gor = true, ciz = null, son = 0;
    S.dongu = function (fn) { ciz = fn; if (SAKIN) { fn(0, 0); return; } var t0 = performance.now(); var adim = function (now) { raf = 0; if (!gor) return; var dt = Math.min(0.05, (now - (son || now)) / 1000); son = now; fn(Math.max(0, (now - t0) / 1000), Math.max(0, dt)); raf = W.requestAnimationFrame(adim); }; raf = W.requestAnimationFrame(adim); };
    S.ciz = function () { if (ciz && (SAKIN || !raf)) ciz(0, 0); };
    var io = 'IntersectionObserver' in W ? new IntersectionObserver(function (e) { gor = e[0].isIntersecting; if (gor && ciz && !raf && !SAKIN) { son = 0; S.dongu(ciz); } }) : null;
    if (io) io.observe(cv);
    var ro = 'ResizeObserver' in W ? new ResizeObserver(function () { boyut(); if (S.yeniden) S.yeniden(); if (ciz) ciz(0, 0); }) : null;
    if (ro) ro.observe(cv);
    boyut();
    S.dur = function () { if (raf) W.cancelAnimationFrame(raf); raf = 0; ciz = null; if (io) io.disconnect(); if (ro) ro.disconnect(); };
    S.okuYaz = function (satir) { oku.innerHTML = satir.map(function (s) { return '<span><b>' + s[0] + '</b> ' + s[1] + '</span>'; }).join(''); };
    return S;
  }

  var LAB = {};

  /* 1. TEĞET: kesen doğru h→0 ile teğete döner */
  LAB.turev = function (host, dil) {
    var S = iskelet(host, dil, { aria: T(dil, 'Eğri, kesen ve teğet doğrusu', 'Curve, secant and tangent') });
    var FN = { x2: [function (x) { return x * x; }, function (x) { return 2 * x; }, 'x²'], sin: [Math.sin, Math.cos, 'sin x'], kup: [function (x) { return x * x * x - 3 * x; }, function (x) { return 3 * x * x - 3; }, 'x³ − 3x'], ex: [function (x) { return Math.exp(x) / 4; }, function (x) { return Math.exp(x) / 4; }, 'eˣ/4'] };
    var s = { f: 'x2', x0: 1, h: 1.2, hedefH: null };
    S.sec([['x2', 'x²'], ['sin', 'sin x'], ['kup', 'x³−3x'], ['ex', 'eˣ/4']], s.f, function (v) { s.f = v; });
    var kx = S.kay('x₀', -3, 3, 0.01, s.x0, '', function (v) { s.x0 = v; });
    var kh = S.kay('h', 0.001, 2, 0.001, s.h, '', function (v) { s.h = v; s.hedefH = null; });
    S.dugme(T(dil, 'h → 0 oynat', 'animate h → 0'), function () { s.h = 2; s.hedefH = 0.001; });
    S.kutu(-4, 4, -4, 6);
    S.surukle(function (p) { var f = FN[s.f][0]; return Math.hypot(p.x - S.X(s.x0), p.y - S.Y(f(s.x0))) < 26; }, function (p) { s.x0 = Math.max(-3, Math.min(3, S.iX(p.x))); kx.set(s.x0); });
    S.dongu(function (t, dt) {
      if (s.hedefH != null) { s.h = Math.max(s.hedefH, s.h * Math.pow(0.25, dt)); kh.set(s.h); if (s.h <= s.hedefH + 1e-6) s.hedefH = null; }
      var f = FN[s.f][0], fp = FN[s.f][1], x0 = s.x0, y0 = f(x0), x1 = x0 + s.h, y1 = f(x1), m = (y1 - y0) / s.h, mt = fp(x0);
      S.zemin(true); S.egri(f, RENK.tebesir, 2.6);
      S.egri(function (x) { return y0 + m * (x - x0); }, RENK.tur, 1.8, null, null, [6, 5]);
      S.egri(function (x) { return y0 + mt * (x - x0); }, RENK.cam, 2.2);
      S.nokta(S.X(x1), S.Y(y1), 5, RENK.tur);
      var nab = SAKIN ? 0 : (Math.sin(t * 3) + 1) * 2;
      S.nokta(S.X(x0), S.Y(y0), 7 + nab, RENK.sari, true);
      S.yazi('f(x) = ' + FN[s.f][2], 12, 20, RENK.tebesir, 12);
      S.okuYaz([[T(dil, 'kesen eğimi', 'secant slope'), fmt(m, dil)], [T(dil, 'teğet eğimi f′(x₀)', "tangent slope f′(x₀)"), fmt(mt, dil)], [T(dil, 'fark', 'gap'), fmt(Math.abs(m - mt), dil, 4)]]);
    });
    return S;
  };

  /* 2. RIEMANN: dikdörtgen sayısı arttıkça alan yakınsar */
  LAB.riemann = function (host, dil) {
    var S = iskelet(host, dil, { aria: T(dil, 'Riemann dikdörtgenleri', 'Riemann rectangles') });
    var FN = { x2: [function (x) { return x * x / 4 + 0.5; }, 'x²/4 + ½'], sin: [function (x) { return Math.sin(x) + 1.5; }, 'sin x + 1,5'], kok: [function (x) { return 2 * Math.sqrt(Math.max(0, x)); }, '2√x'] };
    var s = { f: 'x2', a: 0, b: 4, n: 6, yol: 'sol', anim: 0 };
    S.sec([['x2', 'x²/4+½'], ['sin', 'sin x+1,5'], ['kok', '2√x']], s.f, function (v) { s.f = v; s.anim = 0; });
    S.sec([['sol', T(dil, 'sol', 'left')], ['sag', T(dil, 'sağ', 'right')], ['orta', T(dil, 'orta', 'mid')], ['yamuk', T(dil, 'yamuk', 'trapezoid')]], s.yol, function (v) { s.yol = v; s.anim = 0; });
    S.kay('a', 0, 3, 0.5, s.a, '', function (v) { s.a = Math.min(v, s.b - 0.5); s.anim = 0; });
    S.kay('b', 1, 6, 0.5, s.b, '', function (v) { s.b = Math.max(v, s.a + 0.5); s.anim = 0; });
    var kn = S.kay('n', 1, 60, 1, s.n, '', function (v) { s.n = v; s.anim = 0; });
    S.kutu(-0.5, 6.5, -0.5, 6);
    S.dongu(function (t, dt) {
      s.anim = Math.min(1, s.anim + dt * 2.5); if (SAKIN) s.anim = 1;
      var f = FN[s.f][0], dx = (s.b - s.a) / s.n, top = 0, ctx = S.ctx;
      S.zemin(true);
      for (var i = 0; i < s.n; i++) {
        var xl = s.a + i * dx, xr = xl + dx, k = Math.min(1, Math.max(0, s.anim * s.n * 1.2 - i * 1.0 + 1) );
        var yl = f(xl), yr = f(xr), ym = f((xl + xr) / 2), yy = s.yol === 'sol' ? yl : s.yol === 'sag' ? yr : ym;
        ctx.fillStyle = 'rgba(255,216,107,' + (0.28 * k) + ')'; ctx.strokeStyle = 'rgba(255,216,107,' + (0.9 * k) + ')'; ctx.lineWidth = 1.2;
        ctx.beginPath();
        if (s.yol === 'yamuk') { ctx.moveTo(S.X(xl), S.Y(0)); ctx.lineTo(S.X(xl), S.Y(yl * k)); ctx.lineTo(S.X(xr), S.Y(yr * k)); ctx.lineTo(S.X(xr), S.Y(0)); top += (yl + yr) / 2 * dx; }
        else { ctx.rect(S.X(xl), S.Y(yy * k), S.X(xr) - S.X(xl), S.Y(0) - S.Y(yy * k)); top += yy * dx; }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      S.egri(f, RENK.tebesir, 2.6);
      var gercek = 0, M = 2000; for (var j = 0; j < M; j++) gercek += f(s.a + (j + 0.5) * (s.b - s.a) / M) * (s.b - s.a) / M;
      S.yazi('f(x) = ' + FN[s.f][1], 12, 20, RENK.tebesir, 12);
      S.okuYaz([[T(dil, 'yaklaşık', 'approx.'), fmt(top, dil, 4)], [T(dil, 'gerçek ∫', 'exact ∫'), fmt(gercek, dil, 4)], [T(dil, 'hata', 'error'), fmt(Math.abs(top - gercek), dil, 4)]]);
    });
    return S;
  };

  /* 3. TAYLOR: terim sayısı arttıkça polinom fonksiyonu sarar */
  LAB.taylor = function (host, dil) {
    var S = iskelet(host, dil, { aria: T(dil, 'Taylor polinomu', 'Taylor polynomial') });
    var FN = {
      sin: [Math.sin, function (n) { return n % 2 === 0 ? 0 : (((n - 1) / 2) % 2 === 0 ? 1 : -1); }, 'sin x'],
      cos: [Math.cos, function (n) { return n % 2 === 1 ? 0 : ((n / 2) % 2 === 0 ? 1 : -1); }, 'cos x'],
      ex: [Math.exp, function () { return 1; }, 'eˣ'],
      geo: [function (x) { return 1 / (1 - x); }, function (n) { return W.FORMULO ? W.FORMULO.fact(n) : 1; }, '1/(1−x)']
    };
    var s = { f: 'sin', n: 3, oto: false, sayac: 0 };
    S.sec([['sin', 'sin x'], ['cos', 'cos x'], ['ex', 'eˣ'], ['geo', '1/(1−x)']], s.f, function (v) { s.f = v; });
    var kn = S.kay(T(dil, 'derece n', 'degree n'), 0, 15, 1, s.n, '', function (v) { s.n = v; s.oto = false; });
    S.dugme(T(dil, 'terim terim oynat', 'play term by term'), function () { s.oto = true; s.n = 0; s.sayac = 0; kn.set(0); });
    S.kutu(-6.5, 6.5, -3, 3);
    var fact = function (n) { var r = 1; for (var i = 2; i <= n; i++) r *= i; return r; };
    S.dongu(function (t, dt) {
      if (s.oto) { s.sayac += dt; if (s.sayac > 0.6) { s.sayac = 0; s.n++; kn.set(s.n); if (s.n >= 15) s.oto = false; } }
      var F_ = FN[s.f], P = function (x) { var top = 0; for (var k = 0; k <= s.n; k++) top += F_[1](k) / fact(k) * Math.pow(x, k); return top; };
      S.zemin(true);
      if (s.f === 'geo') { S.ctx.fillStyle = 'rgba(255,159,90,.08)'; S.ctx.fillRect(S.X(-1), 0, S.X(1) - S.X(-1), S.h); }
      S.egri(F_[0], RENK.tebesir, 2.6);
      S.egri(P, RENK.pembe, 2.2);
      S.yazi(F_[2] + '  ·  P' + s.n + '(x)', 12, 20, RENK.tebesir, 12);
      var hata = Math.abs(F_[0](1) - P(1));
      S.okuYaz([[T(dil, 'terim', 'terms'), String(s.n + 1)], ['P(1)', fmt(P(1), dil, 5)], [T(dil, 'hata x=1', 'error at x=1'), fmt(hata, dil, 6)]]);
    });
    return S;
  };

  /* 4. EĞİK ATIŞ */
  LAB.atis = function (host, dil) {
    var S = iskelet(host, dil, { aria: T(dil, 'Eğik atış yörüngesi', 'Projectile trajectory') });
    var s = { v0: 20, th: 45, g: 9.81, t: 0, iz: [] };
    var sifirla = function () { s.t = 0; };
    S.kay('v₀', 5, 40, 0.5, s.v0, 'm/s', function (v) { s.v0 = v; sifirla(); });
    S.kay('θ', 5, 85, 1, s.th, '°', function (v) { s.th = v; sifirla(); });
    S.kay('g', 1.6, 24.8, 0.01, s.g, 'm/s²', function (v) { s.g = v; sifirla(); });
    S.sec([['9.81', T(dil, 'Dünya', 'Earth')], ['1.62', T(dil, 'Ay', 'Moon')], ['3.71', 'Mars']], '9.81', function (v) { s.g = +v; S.kont.querySelectorAll('input')[2].value = v; S.kont.querySelectorAll('input')[2].dispatchEvent(new Event('input')); });
    S.dongu(function (t, dt) {
      var r = s.th * Math.PI / 180, vx = s.v0 * Math.cos(r), vy = s.v0 * Math.sin(r), T_ = 2 * vy / s.g, R = vx * T_, H = vy * vy / (2 * s.g);
      var lim = Math.max(45, R * 1.1, H * 1.6);
      S.kutu(-lim * 0.04, lim, -lim * 0.04, lim * 0.62, 30);
      S.zemin(true);
      var ctx = S.ctx;
      ctx.strokeStyle = 'rgba(234,244,255,.25)'; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(S.X(R / 2), S.Y(0)); ctx.lineTo(S.X(R / 2), S.Y(H)); ctx.stroke(); ctx.setLineDash([]);
      S.egri(function (x) { var tt = x / vx; return vy * tt - 0.5 * s.g * tt * tt; }, 'rgba(234,244,255,.55)', 1.6, 0, R, [6, 6]);
      s.t += dt * Math.max(0.6, T_ / 3); if (s.t > T_ + 0.6) s.t = 0;
      var tt = Math.min(s.t, T_), bx = vx * tt, by = vy * tt - 0.5 * s.g * tt * tt;
      S.egri(function (x) { var q = x / vx; return vy * q - 0.5 * s.g * q * q; }, RENK.sari, 2.6, 0, Math.max(0.001, bx));
      S.ok(S.X(bx), S.Y(by), S.X(bx) + vx * 1.6, S.Y(by) - (vy - s.g * tt) * 1.6, RENK.cam, 1.6);
      S.nokta(S.X(bx), S.Y(by), 7, RENK.tur, true);
      S.yazi('R', S.X(R) - 4, S.Y(0) - 8, RENK.sari, 12); S.yazi('H', S.X(R / 2) + 6, S.Y(H) + 4, RENK.sari, 12);
      S.okuYaz([[T(dil, 'menzil R', 'range R'), fmt(R, dil, 2) + ' m'], [T(dil, 'tepe H', 'peak H'), fmt(H, dil, 2) + ' m'], [T(dil, 'uçuş süresi', 'flight time'), fmt(T_, dil, 2) + ' s']]);
    });
    return S;
  };

  /* 5. SARKAÇ: doğrusal olmayan denklem RK4 ile; küçük açı periyodu ile karşılaştırma */
  LAB.sarkac = function (host, dil) {
    var S = iskelet(host, dil, { aria: T(dil, 'Salınan sarkaç', 'Swinging pendulum') });
    var s = { L: 1, g: 9.81, th0: 20, th: 20 * Math.PI / 180, w: 0, gecen: 0, son: 0, olcum: null, iz: [] };
    var bas = function () { s.th = s.th0 * Math.PI / 180; s.w = 0; s.gecen = 0; s.son = 0; s.olcum = null; s.iz = []; };
    S.kay('L', 0.2, 5, 0.05, s.L, 'm', function (v) { s.L = v; bas(); });
    S.kay('θ₀', 2, 80, 1, s.th0, '°', function (v) { s.th0 = v; bas(); });
    S.kay('g', 1.6, 24.8, 0.01, s.g, 'm/s²', function (v) { s.g = v; bas(); });
    var ivme = function (th) { return -s.g / s.L * Math.sin(th); };
    S.dongu(function (t, dt) {
      var n = 8, h = dt / n;
      for (var i = 0; i < n; i++) {
        var k1t = s.w, k1w = ivme(s.th), k2t = s.w + h / 2 * k1w, k2w = ivme(s.th + h / 2 * k1t), k3t = s.w + h / 2 * k2w, k3w = ivme(s.th + h / 2 * k2t), k4t = s.w + h * k3w, k4w = ivme(s.th + h * k3t);
        var oncekiW = s.w;
        s.th += h / 6 * (k1t + 2 * k2t + 2 * k3t + k4t); s.w += h / 6 * (k1w + 2 * k2w + 2 * k3w + k4w); s.gecen += h;
        if (oncekiW > 0 && s.w <= 0) { if (s.son) s.olcum = s.gecen - s.son; s.son = s.gecen; }
      }
      var ctx = S.ctx, w = S.w, hh = S.h, px = w / 2, py = 26, olc = (hh - 70) / Math.max(1, s.L) * Math.min(1, s.L / 1) ;
      var Lpx = Math.min(hh - 70, 60 + s.L * 70), bx = px + Lpx * Math.sin(s.th), by = py + Lpx * Math.cos(s.th);
      S.zemin(false);
      ctx.strokeStyle = 'rgba(234,244,255,.3)'; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + Lpx + 14); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255,216,107,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py, Lpx * 0.35, Math.PI / 2 - s.th0 * Math.PI / 180, Math.PI / 2 + s.th0 * Math.PI / 180); ctx.stroke();
      s.iz.push([bx, by]); if (s.iz.length > 40) s.iz.shift();
      for (var j = 1; j < s.iz.length; j++) { ctx.strokeStyle = 'rgba(127,227,255,' + (j / s.iz.length * 0.6) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s.iz[j - 1][0], s.iz[j - 1][1]); ctx.lineTo(s.iz[j][0], s.iz[j][1]); ctx.stroke(); }
      ctx.fillStyle = RENK.tebesir; ctx.fillRect(px - 40, py - 6, 80, 6);
      ctx.strokeStyle = RENK.tebesir; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke();
      S.nokta(bx, by, 14, RENK.sari, true);
      var Tk = 2 * Math.PI * Math.sqrt(s.L / s.g);
      S.okuYaz([[T(dil, 'küçük açı T', 'small-angle T'), fmt(Tk, dil, 3) + ' s'], [T(dil, 'ölçülen T', 'measured T'), s.olcum ? fmt(s.olcum, dil, 3) + ' s' : '…'], [T(dil, 'fark', 'gap'), s.olcum ? fmt((s.olcum / Tk - 1) * 100, dil, 1) + ' %' : '…']]);
    });
    return S;
  };

  /* 6. ELEKTRİK ALAN ÇİZGİLERİ: iki yük, sürüklenebilir */
  LAB.alan = function (host, dil) {
    var S = iskelet(host, dil, { aria: T(dil, 'İki yükün alan çizgileri', 'Field lines of two charges') });
    var s = { y: [{ x: -1.2, y: 0, q: 2 }, { x: 1.2, y: 0, q: -2 }], tut: -1, parca: [] };
    S.kay('q₁', -5, 5, 0.5, 2, 'μC', function (v) { s.y[0].q = v || 0.5; s.parca = []; });
    S.kay('q₂', -5, 5, 0.5, -2, 'μC', function (v) { s.y[1].q = v || -0.5; s.parca = []; });
    S.kutu(-3, 3, -2, 2, 0);
    S.yeniden = function () { var ar = S.w / S.h; S.kutu(-2 * ar, 2 * ar, -2, 2, 0); };
    S.yeniden();
    S.surukle(function (p) { for (var i = 0; i < 2; i++) if (Math.hypot(p.x - S.X(s.y[i].x), p.y - S.Y(s.y[i].y)) < 24) { s.tut = i; return true; } return false; },
      function (p) { var Y = s.y[s.tut]; Y.x = S.iX(p.x); Y.y = S.iY(p.y); s.parca = []; });
    var E = function (x, y) { var ex = 0, ey = 0; s.y.forEach(function (Y) { var dx = x - Y.x, dy = y - Y.y, r2 = dx * dx + dy * dy + 1e-4, r3 = r2 * Math.sqrt(r2); ex += Y.q * dx / r3; ey += Y.q * dy / r3; }); return [ex, ey]; };
    var cizgiler = function () {
      var L = [];
      s.y.forEach(function (Y) {
        var n = Math.round(Math.abs(Y.q) * 4) + 4, yon = Y.q > 0 ? 1 : -1;
        for (var k = 0; k < n; k++) {
          var a = 2 * Math.PI * k / n, x = Y.x + 0.08 * Math.cos(a), y = Y.y + 0.08 * Math.sin(a), yol = [[x, y]];
          for (var i = 0; i < 400; i++) {
            var e = E(x, y), m = Math.hypot(e[0], e[1]) || 1; x += yon * 0.03 * e[0] / m; y += yon * 0.03 * e[1] / m; yol.push([x, y]);
            if (Math.abs(x) > 6 || Math.abs(y) > 4) break;
            var dur = false; s.y.forEach(function (Z) { if (Z !== Y && Math.hypot(x - Z.x, y - Z.y) < 0.07) dur = true; }); if (dur) break;
          }
          L.push({ yol: yon > 0 ? yol : yol.reverse() });
        }
      });
      return L;
    };
    var onbellek = null, anahtar = '';
    S.dongu(function (t, dt) {
      var key = s.y.map(function (Y) { return Y.x.toFixed(2) + Y.y.toFixed(2) + Y.q; }).join('|') + S.w;
      if (key !== anahtar) { anahtar = key; onbellek = cizgiler(); }
      var ctx = S.ctx; S.zemin(false);
      onbellek.forEach(function (c, ci) {
        ctx.strokeStyle = 'rgba(234,244,255,.7)'; ctx.lineWidth = 1.3; ctx.beginPath();
        c.yol.forEach(function (p, i) { if (i) ctx.lineTo(S.X(p[0]), S.Y(p[1])); else ctx.moveTo(S.X(p[0]), S.Y(p[1])); }); ctx.stroke();
        if (!SAKIN && c.yol.length > 4) { var k = Math.floor(((t * 30 + ci * 13) % c.yol.length)); var p = c.yol[k]; S.nokta(S.X(p[0]), S.Y(p[1]), 2.4, RENK.cam); }
      });
      s.y.forEach(function (Y, i) { S.nokta(S.X(Y.x), S.Y(Y.y), 15, Y.q > 0 ? RENK.tur : RENK.cam, true); S.yazi(Y.q > 0 ? '+' : '−', S.X(Y.x), S.Y(Y.y) + 5, '#183A30', 16, 'center'); });
      S.yazi(T(dil, 'yükleri sürükle', 'drag the charges'), 10, 18, RENK.soluk, 11);
      var d = Math.hypot(s.y[0].x - s.y[1].x, s.y[0].y - s.y[1].y), F = 8.988e9 * Math.abs(s.y[0].q * s.y[1].q) * 1e-12 / (d * d);
      S.okuYaz([[T(dil, 'uzaklık', 'distance'), fmt(d, dil, 2) + ' m'], [T(dil, 'kuvvet', 'force'), fmt(F, dil, 4) + ' N'], [T(dil, 'etkileşim', 'interaction'), s.y[0].q * s.y[1].q < 0 ? T(dil, 'çeker', 'attract') : T(dil, 'iter', 'repel')]]);
    });
    return S;
  };

  /* 7. RC ŞARJ */
  LAB.rc = function (host, dil) {
    var S = iskelet(host, dil, { aria: T(dil, 'RC devresi şarj eğrisi', 'RC charging curve') });
    var s = { R: 10, C: 100, e: 12, t: 0 };
    S.kay('R', 1, 50, 0.5, s.R, 'kΩ', function (v) { s.R = v; s.t = 0; });
    S.kay('C', 10, 500, 5, s.C, 'μF', function (v) { s.C = v; s.t = 0; });
    S.kay('ε', 1, 24, 0.5, s.e, 'V', function (v) { s.e = v; });
    S.dongu(function (t, dt) {
      var tau = s.R * 1e3 * s.C * 1e-6, Tm = 5 * tau;
      s.t += dt * Tm / 4; if (s.t > Tm * 1.15) s.t = 0;
      S.kutu(0, Tm, -0.05, 1.15, 34);
      S.zemin(false);
      var ctx = S.ctx;
      ctx.strokeStyle = RENK.eksen; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(S.X(0), S.Y(0)); ctx.lineTo(S.X(Tm), S.Y(0)); ctx.moveTo(S.X(0), S.Y(0)); ctx.lineTo(S.X(0), S.Y(1.12)); ctx.stroke();
      for (var k = 1; k <= 5; k++) { ctx.strokeStyle = 'rgba(234,244,255,.18)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(S.X(k * tau), S.Y(0)); ctx.lineTo(S.X(k * tau), S.Y(1.05)); ctx.stroke(); ctx.setLineDash([]); S.yazi(k + 'τ', S.X(k * tau) - 8, S.Y(0) + 16, RENK.soluk, 10); }
      ctx.strokeStyle = 'rgba(255,216,107,.35)'; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(S.X(0), S.Y(0.632)); ctx.lineTo(S.X(tau), S.Y(0.632)); ctx.stroke(); ctx.setLineDash([]);
      S.yazi('63%', S.X(0) + 4, S.Y(0.632) - 5, RENK.sari, 10);
      S.egri(function (x) { return 1 - Math.exp(-x / tau); }, 'rgba(234,244,255,.4)', 1.5, 0, Tm, [5, 5]);
      S.egri(function (x) { return Math.exp(-x / tau); }, 'rgba(127,227,255,.4)', 1.5, 0, Tm, [5, 5]);
      var tt = Math.min(s.t, Tm);
      S.egri(function (x) { return 1 - Math.exp(-x / tau); }, RENK.sari, 2.6, 0, Math.max(1e-6, tt));
      S.egri(function (x) { return Math.exp(-x / tau); }, RENK.cam, 2.2, 0, Math.max(1e-6, tt));
      var q = 1 - Math.exp(-tt / tau);
      S.nokta(S.X(tt), S.Y(q), 6, RENK.sari, true);
      S.yazi('q/Q', S.X(Tm) - 40, S.Y(1) - 6, RENK.sari, 11); S.yazi('I/I₀', S.X(Tm) - 40, S.Y(0.08) - 6, RENK.cam, 11);
      /* sığaç simgesi: levhalar dolar */
      var cx = S.w - 70, cy = 46; ctx.strokeStyle = RENK.tebesir; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - 10, cy - 18); ctx.lineTo(cx - 10, cy + 18); ctx.moveTo(cx + 10, cy - 18); ctx.lineTo(cx + 10, cy + 18); ctx.stroke();
      ctx.fillStyle = 'rgba(255,216,107,' + q + ')'; ctx.fillRect(cx - 8, cy - 18, 16, 36);
      S.okuYaz([['τ = RC', fmt(tau, dil, 3) + ' s'], ['t', fmt(tt, dil, 2) + ' s'], [T(dil, 'yük', 'charge'), fmt(q * 100, dil, 1) + ' %  (' + fmt(s.C * s.e * q, dil, 0) + ' μC)']]);
    });
    return S;
  };

  /* 8. MATRİS DÖNÜŞÜMÜ: birim kare ve ızgara A ile dönüşür */
  LAB.matris = function (host, dil) {
    var S = iskelet(host, dil, { aria: T(dil, '2×2 matris dönüşümü', '2×2 matrix transformation') });
    var s = { a: 2, b: 1, c: 0.5, d: 1.5, k: 0, yon: 1, oyna: true };
    var ka = S.kay('a', -3, 3, 0.1, s.a, '', function (v) { s.a = v; }), kb = S.kay('b', -3, 3, 0.1, s.b, '', function (v) { s.b = v; }),
      kc = S.kay('c', -3, 3, 0.1, s.c, '', function (v) { s.c = v; }), kd = S.kay('d', -3, 3, 0.1, s.d, '', function (v) { s.d = v; });
    S.sec([['oyna', T(dil, 'I → A oynat', 'play I → A')], ['dur', T(dil, 'A’da dur', 'hold at A')]], 'oyna', function (v) { s.oyna = v === 'oyna'; if (!s.oyna) s.k = 1; });
    S.sec([['dondur', T(dil, 'döndürme', 'rotation')], ['kayma', T(dil, 'kayma', 'shear')], ['tekil', T(dil, 'tekil', 'singular')]], '', function (v) {
      var m = v === 'dondur' ? [0, -1, 1, 0] : v === 'kayma' ? [1, 1, 0, 1] : [1, 2, 0.5, 1];
      s.a = m[0]; s.b = m[1]; s.c = m[2]; s.d = m[3]; ka.set(s.a); kb.set(s.b); kc.set(s.c); kd.set(s.d); s.k = 0;
    });
    S.yeniden = function () { var ar = S.w / S.h; S.kutu(-4 * ar, 4 * ar, -4, 4, 0); };
    S.yeniden();
    S.dongu(function (t, dt) {
      if (s.oyna && !SAKIN) { s.k += s.yon * dt * 0.5; if (s.k > 1.4) { s.yon = -1; } if (s.k < -0.3) { s.yon = 1; } } else s.k = 1;
      var k = Math.max(0, Math.min(1, s.k)), e = k * k * (3 - 2 * k);
      var A = [1 + (s.a - 1) * e, s.b * e, s.c * e, 1 + (s.d - 1) * e];
      var M = function (x, y) { return [A[0] * x + A[1] * y, A[2] * x + A[3] * y]; };
      var ctx = S.ctx; S.zemin(true);
      ctx.lineWidth = 1;
      for (var i = -6; i <= 6; i++) {
        ctx.strokeStyle = i === 0 ? 'rgba(127,227,255,.6)' : 'rgba(127,227,255,.22)';
        var p0 = M(i, -6), p1 = M(i, 6); ctx.beginPath(); ctx.moveTo(S.X(p0[0]), S.Y(p0[1])); ctx.lineTo(S.X(p1[0]), S.Y(p1[1])); ctx.stroke();
        p0 = M(-6, i); p1 = M(6, i); ctx.beginPath(); ctx.moveTo(S.X(p0[0]), S.Y(p0[1])); ctx.lineTo(S.X(p1[0]), S.Y(p1[1])); ctx.stroke();
      }
      var q = [M(0, 0), M(1, 0), M(1, 1), M(0, 1)], det = A[0] * A[3] - A[1] * A[2];
      ctx.fillStyle = det >= 0 ? 'rgba(255,216,107,.35)' : 'rgba(255,159,90,.35)'; ctx.strokeStyle = RENK.sari; ctx.lineWidth = 2;
      ctx.beginPath(); q.forEach(function (p, i) { if (i) ctx.lineTo(S.X(p[0]), S.Y(p[1])); else ctx.moveTo(S.X(p[0]), S.Y(p[1])); }); ctx.closePath(); ctx.fill(); ctx.stroke();
      S.ok(S.X(0), S.Y(0), S.X(q[1][0]), S.Y(q[1][1]), RENK.tur, 3); S.ok(S.X(0), S.Y(0), S.X(q[3][0]), S.Y(q[3][1]), RENK.yesil, 3);
      S.yazi('Ai', S.X(q[1][0]) + 6, S.Y(q[1][1]) - 6, RENK.tur, 12); S.yazi('Aj', S.X(q[3][0]) + 6, S.Y(q[3][1]) - 6, RENK.yesil, 12);
      /* özvektörler (yalnız tam A için) */
      var tr = s.a + s.d, dt0 = s.a * s.d - s.b * s.c, dis = tr * tr - 4 * dt0, oz = [];
      if (dis >= 0 && k >= 0.999) {
        [(tr + Math.sqrt(dis)) / 2, (tr - Math.sqrt(dis)) / 2].forEach(function (l) {
          var vx = s.b, vy = l - s.a; if (Math.abs(vx) + Math.abs(vy) < 1e-9) { vx = l - s.d; vy = s.c; } if (Math.abs(vx) + Math.abs(vy) < 1e-9) { vx = 1; vy = 0; }
          var m = Math.hypot(vx, vy); vx /= m; vy /= m; oz.push(l);
          ctx.strokeStyle = 'rgba(247,168,224,.85)'; ctx.setLineDash([7, 5]); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(S.X(-8 * vx), S.Y(-8 * vy)); ctx.lineTo(S.X(8 * vx), S.Y(8 * vy)); ctx.stroke(); ctx.setLineDash([]);
        });
      }
      S.okuYaz([['det A', fmt(s.a * s.d - s.b * s.c, dil, 2)], ['λ', oz.length ? oz.map(function (l) { return fmt(l, dil, 2); }).join(' · ') : (dis < 0 ? T(dil, 'karmaşık', 'complex') : '…')], [T(dil, 'alan', 'area'), '× ' + fmt(Math.abs(s.a * s.d - s.b * s.c), dil, 2)]]);
    });
    return S;
  };

  /* 9. YÖN ALANI: tıkla, çözüm eğrisi çizilsin */
  LAB.yon = function (host, dil) {
    var S = iskelet(host, dil, { aria: T(dil, 'Diferansiyel denklemin yön alanı', 'Slope field of an ODE') });
    var DD = { ky: [function (x, y, k) { return k * y; }, "y′ = ky"], xy: [function (x, y) { return x - y; }, "y′ = x − y"], lojistik: [function (x, y) { return y * (1 - y / 3); }, "y′ = y(1 − y/3)"], sin: [function (x, y) { return Math.sin(x) - y / 2; }, "y′ = sin x − y/2"] };
    var s = { e: 'ky', k: 0.5, egriler: [], ciz: [] };
    S.sec([['ky', "y′=ky"], ['xy', "y′=x−y"], ['lojistik', T(dil, 'lojistik', 'logistic')], ['sin', "y′=sin x−y/2"]], s.e, function (v) { s.e = v; s.egriler = []; });
    S.kay('k', -1, 1, 0.05, s.k, '', function (v) { s.k = v; s.egriler = []; });
    S.dugme(T(dil, 'eğrileri temizle', 'clear curves'), function () { s.egriler = []; });
    S.yeniden = function () { var ar = S.w / S.h; S.kutu(-4 * ar, 4 * ar, -4, 4, 0); };
    S.yeniden();
    var coz = function (x0, y0) {
      var f = DD[s.e][0], yol = [], h = 0.02;
      [1, -1].forEach(function (yon) {
        var x = x0, y = y0, p = [];
        for (var i = 0; i < 1200; i++) {
          var k1 = f(x, y, s.k), k2 = f(x + yon * h / 2, y + yon * h / 2 * k1, s.k), k3 = f(x + yon * h / 2, y + yon * h / 2 * k2, s.k), k4 = f(x + yon * h, y + yon * h * k3, s.k);
          y += yon * h / 6 * (k1 + 2 * k2 + 2 * k3 + k4); x += yon * h; if (Math.abs(y) > 40 || x < S.sinir[0] - 1 || x > S.sinir[1] + 1) break; p.push([x, y]);
        }
        if (yon < 0) yol = p.reverse().concat([[x0, y0]]); else yol = yol.concat(p);
      });
      return { yol: yol, bas: 0, x0: x0, y0: y0 };
    };
    S.cv.addEventListener('click', function (e) { var r = S.cv.getBoundingClientRect(); s.egriler.push(coz(S.iX(e.clientX - r.left), S.iY(e.clientY - r.top))); if (s.egriler.length > 8) s.egriler.shift(); });
    s.egriler.push(coz(0, 1));
    S.dongu(function (t, dt) {
      var f = DD[s.e][0], ctx = S.ctx; S.zemin(true);
      var adim = 0.5; ctx.strokeStyle = 'rgba(234,244,255,.55)'; ctx.lineWidth = 1.3;
      for (var x = Math.ceil(S.sinir[0] / adim) * adim; x <= S.sinir[1]; x += adim) for (var y = -4; y <= 4; y += adim) {
        var m = f(x, y, s.k), a = Math.atan(m), L = 9; ctx.beginPath(); ctx.moveTo(S.X(x) - L * Math.cos(a), S.Y(y) + L * Math.sin(a)); ctx.lineTo(S.X(x) + L * Math.cos(a), S.Y(y) - L * Math.sin(a)); ctx.stroke();
      }
      s.egriler.forEach(function (c, i) {
        c.bas = SAKIN ? 1 : Math.min(1, c.bas + dt * 0.8);
        var n = Math.floor(c.yol.length * c.bas); ctx.strokeStyle = [RENK.sari, RENK.cam, RENK.pembe, RENK.tur, RENK.yesil][i % 5]; ctx.lineWidth = 2.6; ctx.beginPath();
        for (var j = 0; j < n; j++) { var p = c.yol[j]; if (j) ctx.lineTo(S.X(p[0]), S.Y(p[1])); else ctx.moveTo(S.X(p[0]), S.Y(p[1])); }
        ctx.stroke(); S.nokta(S.X(c.x0), S.Y(c.y0), 4.5, RENK.tebesir);
      });
      S.yazi(DD[s.e][1] + T(dil, '   ·   tıkla: başlangıç koşulu', '   ·   click: initial condition'), 10, 18, RENK.tebesir, 11);
      S.okuYaz([[T(dil, 'denklem', 'equation'), DD[s.e][1]], [T(dil, 'çözüm eğrisi', 'solution curves'), String(s.egriler.length)], [T(dil, 'yöntem', 'method'), 'RK4']]);
    });
    return S;
  };

  /* 10. NORMAL DAĞILIM: a < X < b alanı */
  LAB.normal = function (host, dil) {
    var S = iskelet(host, dil, { aria: T(dil, 'Normal dağılım altında alan', 'Area under the normal curve') });
    var s = { mu: 70, sg: 10, a: 60, b: 85, gor: 0 };
    S.kay('μ', 40, 100, 0.5, s.mu, '', function (v) { s.mu = v; s.gor = 0; });
    S.kay('σ', 2, 25, 0.5, s.sg, '', function (v) { s.sg = v; s.gor = 0; });
    var ka = S.kay('a', 0, 140, 0.5, s.a, '', function (v) { s.a = Math.min(v, s.b); s.gor = 0; });
    var kb = S.kay('b', 0, 140, 0.5, s.b, '', function (v) { s.b = Math.max(v, s.a); s.gor = 0; });
    S.sec([['1', '±1σ'], ['2', '±2σ'], ['3', '±3σ']], '', function (v) { s.a = s.mu - v * s.sg; s.b = s.mu + v * s.sg; ka.set(s.a); kb.set(s.b); s.gor = 0; });
    S.dongu(function (t, dt) {
      s.gor = SAKIN ? 1 : Math.min(1, s.gor + dt * 2);
      var pdf = function (x) { return Math.exp(-0.5 * Math.pow((x - s.mu) / s.sg, 2)) / (s.sg * Math.sqrt(2 * Math.PI)); }, top = pdf(s.mu);
      S.kutu(s.mu - 4 * s.sg, s.mu + 4 * s.sg, -top * 0.06, top * 1.25, 30);
      S.zemin(false);
      var ctx = S.ctx; ctx.strokeStyle = RENK.eksen; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, S.Y(0)); ctx.lineTo(S.w, S.Y(0)); ctx.stroke();
      for (var k = -3; k <= 3; k++) { var xk = s.mu + k * s.sg; ctx.strokeStyle = 'rgba(234,244,255,.18)'; ctx.beginPath(); ctx.moveTo(S.X(xk), S.Y(0)); ctx.lineTo(S.X(xk), S.Y(pdf(xk))); ctx.stroke(); S.yazi(k === 0 ? 'μ' : (k > 0 ? '+' : '') + k + 'σ', S.X(xk), S.Y(0) + 15, RENK.soluk, 10, 'center'); }
      var b2 = s.a + (s.b - s.a) * s.gor;
      ctx.fillStyle = 'rgba(255,216,107,.4)'; ctx.beginPath(); ctx.moveTo(S.X(s.a), S.Y(0));
      for (var i = 0; i <= 120; i++) { var x = s.a + (b2 - s.a) * i / 120; ctx.lineTo(S.X(x), S.Y(pdf(x))); }
      ctx.lineTo(S.X(b2), S.Y(0)); ctx.closePath(); ctx.fill();
      S.egri(pdf, RENK.tebesir, 2.6);
      var za = (s.a - s.mu) / s.sg, zb = (s.b - s.mu) / s.sg, P = Phi(zb) - Phi(za);
      S.yazi(fmt(P * 100, dil, 1) + '%', S.X((s.a + s.b) / 2), S.Y(top * 0.35), RENK.sari, 16, 'center');
      S.okuYaz([['z(a)', fmt(za, dil, 2)], ['z(b)', fmt(zb, dil, 2)], ['P(a<X<b)', fmt(P, dil, 4)]]);
    });
    return S;
  };

  /* 11. NEWTON-RAPHSON: teğetler köke iner */
  LAB.newton = function (host, dil) {
    var S = iskelet(host, dil, { aria: T(dil, 'Newton-Raphson yinelemeleri', 'Newton–Raphson iterations') });
    var FN = { k2: [function (x) { return x * x - 2; }, function (x) { return 2 * x; }, 'x² − 2'], cos: [function (x) { return Math.cos(x) - x; }, function (x) { return -Math.sin(x) - 1; }, 'cos x − x'], kup: [function (x) { return x * x * x - 2 * x - 5; }, function (x) { return 3 * x * x - 2; }, 'x³ − 2x − 5'] };
    var s = { f: 'k2', x0: 3, adim: 0, oto: true, sayac: 0 };
    S.sec([['k2', 'x²−2'], ['cos', 'cos x−x'], ['kup', 'x³−2x−5']], s.f, function (v) { s.f = v; s.adim = 0; });
    var kx = S.kay('x₀', -4, 4, 0.05, s.x0, '', function (v) { s.x0 = v; s.adim = 0; });
    S.dugme(T(dil, 'bir adım', 'one step'), function () { s.oto = false; s.adim = Math.min(8, s.adim + 1); });
    S.dugme(T(dil, 'baştan oynat', 'replay'), function () { s.oto = true; s.adim = 0; s.sayac = 0; });
    S.kutu(-4, 4, -6, 10);
    S.surukle(function (p) { return Math.abs(p.x - S.X(s.x0)) < 18 && Math.abs(p.y - S.Y(0)) < 26; }, function (p) { s.x0 = Math.max(-4, Math.min(4, S.iX(p.x))); kx.set(s.x0); s.adim = 0; });
    S.dongu(function (t, dt) {
      if (s.oto && !SAKIN) { s.sayac += dt; if (s.sayac > 0.9) { s.sayac = 0; s.adim++; if (s.adim > 7) { s.adim = 0; } } } else if (SAKIN) s.adim = 6;
      var f = FN[s.f][0], fp = FN[s.f][1], ctx = S.ctx; S.zemin(true); S.egri(f, RENK.tebesir, 2.6);
      var x = s.x0, xs = [x];
      for (var i = 0; i < s.adim; i++) {
        var y = f(x), m = fp(x); if (Math.abs(m) < 1e-9) break; var xn = x - y / m;
        ctx.strokeStyle = 'rgba(234,244,255,.3)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(S.X(x), S.Y(0)); ctx.lineTo(S.X(x), S.Y(y)); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = i === s.adim - 1 ? RENK.sari : 'rgba(255,216,107,.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(S.X(x), S.Y(y)); ctx.lineTo(S.X(xn), S.Y(0)); ctx.stroke();
        S.nokta(S.X(x), S.Y(y), 4, RENK.sari); x = xn; xs.push(x);
      }
      xs.forEach(function (q, i) { S.nokta(S.X(q), S.Y(0), i === xs.length - 1 ? 6 : 3.5, i === xs.length - 1 ? RENK.tur : RENK.cam, i === xs.length - 1); });
      S.yazi('f(x) = ' + FN[s.f][2], 12, 20, RENK.tebesir, 12);
      S.okuYaz([['n', String(xs.length - 1)], ['xₙ', fmt(x, dil, 8)], ['|f(xₙ)|', fmt(Math.abs(f(x)), dil, 8)]]);
    });
    return S;
  };

  W.FOLAB = LAB; W.FOLAB_fmt = fmt;
})(window);
