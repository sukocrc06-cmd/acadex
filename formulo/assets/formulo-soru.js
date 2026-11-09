/* ==========================================================================
   FORMULO · sınırsız soru havuzu (formulo/assets/formulo-soru.js), 08.11.2026
   Kolay: doğrudan hesap. Orta: ters soru (bilinmeyen girdi, monoton olanlardan, ikiye
   bölmeyle doğrulanır). Zor: iki formülü bağlayan zincir sorular. Her soruda iki
   kademeli ipucu ve adım adım çözüm; yanlışlar formulo.hata (hata defteri) içine gider.
   Önek fq-.
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, FO = W.FORMULO;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function al(k, v) { try { var x = localStorage.getItem('formulo.' + k); return x ? JSON.parse(x) : v; } catch (e) { return v; } }
  function koy(k, v) { try { localStorage.setItem('formulo.' + k, JSON.stringify(v)); } catch (e) { } if (W.FOBULUT) W.FOBULUT.degisti(k); }   /* hesaba kayıt: formulo-bulut.js */
  function A() { return W.FORMULO_APP; }
  function dil() { return (A() && A().dil()) || 'tr'; }
  function sayi(n) { return A() ? A().sayi(n) : String(+(+n).toPrecision(4)); }
  function ad(o) { return dil() === 'en' ? (o.en || o.tr) : o.tr; }
  function bul(id) { for (var i = 0; i < FO.formuller.length; i++) if (FO.formuller[i].id === id) return FO.formuller[i]; return null; }
  function sembol(f, key) { var t = D.createElement('div'); t.innerHTML = f.h || ''; var e = t.querySelector('[data-v="' + key + '"]'); return e ? e.innerHTML : esc(key); }
  var Y = {
    tr: { kolay: 'Kolay', orta: 'Orta', zor: 'Zor', konu: 'Konu', hepsi: 'Hepsi', yeni: 'Yeni soru', kontrol: 'Kontrol et', ipucu: 'İpucu', cozum: 'Çözümü göster', cevap: 'Cevabın', dogru: 'Doğru!', yanlis: 'Olmadı, hata defterine yazdım. Doğrusu', puan: 'doğru', seri: 'seri',
      verilen: 'Verilenler', istenen: 'İstenen', formul: 'Formül', si: 'SI birimine çevir', yerine: 'Yerine koy', sonuc: 'Sonuç', ters: 'Bilinmeyeni yalnız bırak', kontrolA: 'Sağlama', adim1: '1. adım', adim2: '2. adım',
      ip1: 'Bu soruda kullanacağın formül:', ip2: 'Değerleri yerine koy:', tersIp: 'Bilinmeyen burada girdi; formülü ona göre çöz.', zincirIp: 'Önce ilk büyüklüğü bul, sonra onu ikinci formülde kullan.',
      soruK: function (o) { return o + ' kaçtır?'; }, soruO: function (o, d, k) { return o + ' ' + d + ' olduğuna göre ' + k + ' kaçtır?'; },
      genel: 'Aşağıdaki değerler veriliyor.', yok: 'Bu konuda hesaplanabilir formül yok; başka bir konu seç.', zincirYok: 'Bu konuda zincir soru yok; orta seviyeden soruldu.', seviyeYok: 'Bu seviyede soru yok; konunun başka bir seviyesinden soruldu.', sayac: function (n) { return 'Bu derste ≈ <b>' + n + '</b> farklı soru üretilebilir'; }, ortaYok: 'Bu konuda ters soru kurulamadı; doğrudan soruldu.',
      hata: 'Hata defteri', hataBos: 'Hata defterin boş. Yanlış yaptığın sorular buraya gelir.', tekrar: 'Benzerini çöz', sil: 'Öğrendim', acadia: ['Hadi bakalım!', 'Bu tam sınavlık.', 'Önce verilenleri yaz.', 'Birimlere dikkat!', 'Sen yaparsın.'], tebrik: ['Harika!', 'Tam isabet!', 'Böyle devam!'], teselli: ['Olsun, çözümüne bak.', 'Hata defterine ekledim.', 'Bir daha deneyelim.'] },
    en: { kolay: 'Easy', orta: 'Medium', zor: 'Hard', konu: 'Topic', hepsi: 'All', yeni: 'New question', kontrol: 'Check', ipucu: 'Hint', cozum: 'Show solution', cevap: 'Your answer', dogru: 'Correct!', yanlis: 'Not quite, saved to your mistake log. Answer', puan: 'correct', seri: 'streak',
      verilen: 'Given', istenen: 'Find', formul: 'Formula', si: 'Convert to SI', yerine: 'Substitute', sonuc: 'Result', ters: 'Isolate the unknown', kontrolA: 'Check', adim1: 'Step 1', adim2: 'Step 2',
      ip1: 'The formula you need:', ip2: 'Substitute the values:', tersIp: 'The unknown is an input here; solve the formula for it.', zincirIp: 'Find the first quantity, then feed it into the second formula.',
      soruK: function (o) { return 'Find the ' + o + '.'; }, soruO: function (o, d, k) { return 'If the ' + o + ' is ' + d + ', find the ' + k + '.'; },
      genel: 'The following values are given.', yok: 'No calculable formula in this topic; pick another.', zincirYok: 'No chain question for this topic; asked a medium one.', seviyeYok: 'No question at this level; picked another level of the topic.', sayac: function (n) { return '≈ <b>' + n + '</b> distinct questions in this course'; }, ortaYok: 'No inverse question for this topic; asked a direct one.',
      hata: 'Mistake log', hataBos: 'Your mistake log is empty. Questions you miss land here.', tekrar: 'Try a similar one', sil: 'Got it', acadia: ['Let’s go!', 'Exam material.', 'Write the givens first.', 'Watch the units!', 'You’ve got this.'], tebrik: ['Great!', 'Spot on!', 'Keep going!'], teselli: ['It happens, see the solution.', 'Added to your mistake log.', 'Let’s try again.'] }
  };
  function T(k) { return Y[dil()][k]; }
  function buyuk(n) { var en = dil() === 'en'; if (n >= 1e6) return sayi(+(n / 1e6).toPrecision(2)) + (en ? ' million' : ' milyon'); if (n >= 1e3) return Math.round(n / 1e3) + (en ? ' thousand' : ' bin'); return String(n); }
  function rast(a) { return a[Math.floor(Math.random() * a.length)]; }

  /* SI çevirisi gösterilecek ön ekli birimler */
  var SI = { 'μC': [1e-6, 'C'], 'nC': [1e-9, 'C'], 'nC/m': [1e-9, 'C/m'], 'μC/m²': [1e-6, 'C/m²'], 'kΩ': [1e3, 'Ω'], 'μF': [1e-6, 'F'], 'pF': [1e-12, 'F'], 'cm': [1e-2, 'm'], 'mm': [1e-3, 'm'], 'mH': [1e-3, 'H'], 'mm²': [1e-6, 'm²'], 'cm²': [1e-4, 'm²'], 'km': [1e3, 'm'], 'MHz': [1e6, 'Hz'], 'ms': [1e-3, 's'], 'mT': [1e-3, 'T'], 'μT': [1e-6, 'T'], 'mN': [1e-3, 'N'], 'mWb': [1e-3, 'Wb'] };

  function yuvarla(q) { var n = q.min + Math.round(Math.random() * 20) * (q.max - q.min) / 20; n = Math.round(n / q.st) * q.st; n = +n.toPrecision(2); if (q.min > 0 && n <= 0) n = q.st; return Math.min(q.max, Math.max(q.min, n)); }
  function degerler(f) { var v = {}; Object.keys(f.v).forEach(function (k) { v[k] = k === 'g' ? f.v[k].val : yuvarla(f.v[k]); }); return v; }
  function gecerli(f, v) { var r = f.o.f(v); return isFinite(r) && Math.abs(r) < 1e15 && (Math.abs(r) > 1e-12 || r === 0); }
  /* bir girdiye göre monoton mu (diğerleri sabitken)? */
  function monoton(f, v, k) {
    var q = f.v[k], n = 16, son = null, yon = 0;
    for (var i = 0; i <= n; i++) {
      var w = Object.assign({}, v); w[k] = q.min + (q.max - q.min) * i / n; if (q.min <= 0 && w[k] === 0 && q.min < 0) continue;
      var r = f.o.f(w); if (!isFinite(r)) return false;
      if (son !== null) { var d = r - son; if (Math.abs(d) < 1e-12 * Math.max(1, Math.abs(r))) return false; var s = d > 0 ? 1 : -1; if (yon && s !== yon) return false; yon = s; }
      son = r;
    }
    return true;
  }
  /* ikiye bölme: f(v[k]=x) = hedef */
  function ikiye(f, v, k, hedef) {
    var q = f.v[k], a = q.min, b = q.max, g = function (x) { var w = Object.assign({}, v); w[k] = x; return f.o.f(w) - hedef; }, fa = g(a);
    for (var i = 0; i < 80; i++) { var m = (a + b) / 2, fm = g(m); if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else b = m; }
    return (a + b) / 2;
  }
  function birimli(f, k, x) { var u = f.v[k].u; return sayi(x) + (u ? ' ' + u : ''); }
  function baglamDoldur(f, v, gizli) {
    if (!f.bag) return '';
    return ad(f.bag).replace(/\{(\w+)\}/g, function (_, k) { return k === gizli ? '<b class="fq-gizli">?</b>' : (f.v[k] ? '<b>' + esc(birimli(f, k, v[k])) + '</b>' : '?'); });
  }
  function verilenHTML(f, v, haric, onceki) { return Object.keys(v).filter(function (k) { return k !== haric && !(onceki && onceki[k] === v[k]); }).map(function (k) { return '<span><i class="fq-s">' + sembol(f, k) + '</i> = ' + esc(birimli(f, k, v[k])) + '</span>'; }).join(''); }
  function siSatir(f, v) {
    var s = []; Object.keys(v).forEach(function (k) { var u = f.v[k].u, c = SI[u]; if (c) s.push('<span><i class="fq-s">' + sembol(f, k) + '</i> = ' + esc(sayi(v[k]) + ' ' + u) + ' = ' + esc(sayi(v[k] * c[0]) + ' ' + c[1]) + '</span>'); });
    return s.join('');
  }
  function yerineHTML(f, v) { return FO.yerine(f, v, sayi, 'fq-d'); }

  /* zincir sorular: B[k] = A'nın sonucu */
  var ZINCIR = [
    { a: 'enerji-korunum', b: 'kinetik', k: 'v', tr: 'Bir cisim sürtünmesiz rampadan {A.h} yükseklikten kayıyor (g = {A.g}); kütlesi {B.m}. Alttaki kinetik enerjisi kaç J?', en: 'A body slides from {A.h} on a frictionless ramp (g = {A.g}); its mass is {B.m}. Kinetic energy at the bottom?' },
    { a: 'newton2', b: 'is', k: 'F', tr: '{A.m} kütleli kasaya {A.a} ivme veren kuvvet, kasayı yatayla {B.th} açıyla {B.d} çekiyor. Yapılan iş kaç J?', en: 'The force giving a {A.m} crate {A.a} pulls it {B.d} at {B.th}. Work done?' },
    { a: 'zamansiz', b: 'kinetik', k: 'v', tr: '{B.m} kütleli araç {A.v0} hızla girip {A.a} ivmeyle {A.dx} yol alıyor. Son kinetik enerjisi?', en: 'A {B.m} car enters at {A.v0} and accelerates at {A.a} over {A.dx}. Final kinetic energy?' },
    { a: 'ortalama-hiz', b: 'kinetik', k: 'v', tr: '{B.m} kütleli bir koşucu {A.dx} yolu {A.dt} sürede sabit hızla koşuyor. Kinetik enerjisi?', en: 'A {B.m} runner covers {A.dx} in {A.dt} at constant speed. Kinetic energy?' },
    { a: 'merkezcil', b: 'newton2', k: 'a', tr: '{B.m} kütleli araba {A.r} yarıçaplı virajı {A.v} hızla dönüyor. Gereken merkezcil kuvvet kaç N?', en: 'A {B.m} car takes a {A.r} curve at {A.v}. Required centripetal force?' },
    { a: 'egik-duzlem', b: 'newton2', k: 'a', tr: '{B.m} kütleli blok {A.th} eğimli, μₖ = {A.mk} olan rampada kayıyor (g = {A.g}). Bloğa etkiyen net kuvvet?', en: 'A {B.m} block slides on a {A.th} ramp with μₖ = {A.mk} (g = {A.g}). Net force on it?' },
    { a: 'esnek-degil', b: 'kinetik', k: 'v', tr: '{A.m1} kütleli araç {A.v1} hızla, {A.v2} hızlı {A.m2} kütleli araca çarpıp yapışıyor. Çarpışmadan sonra {B.m} kütleli enkazın kinetik enerjisi?', en: 'A {A.m1} car at {A.v1} hits and sticks to a {A.m2} car moving at {A.v2}. KE of the {B.m} wreck afterwards?', esle: function (vA, vB) { vB.m = vA.m1 + vA.m2; } },
    { a: 'paralel-iki', b: 'ohm', k: 'R', tr: '{A.R1} ve {A.R2} dirençler paralel bağlı; devreden {B.I} akım geçiyor. Uçlar arasındaki gerilim?', en: '{A.R1} and {A.R2} are in parallel with {B.I} flowing. Voltage across them?' },
    { a: 'ozdirenc', b: 'ohm', k: 'R', tr: '{A.L} uzunluğunda, {A.A} kesitli kablodan (ρ = {A.rho} × 10⁻⁸ Ω·m) {B.I} akım geçiyor. Kablodaki gerilim düşümü?', en: 'A cable {A.L} long, cross-section {A.A} (ρ = {A.rho} × 10⁻⁸ Ω·m) carries {B.I}. Voltage drop?' },
    { a: 'ohm', b: 'sigac-enerji', k: 'V', tr: '{A.R} dirençten {A.I} akım geçiyor; aynı gerilime {B.C} sığaç bağlanıyor. Sığaçta depolanan enerji?', en: '{A.I} flows through {A.R}; a {B.C} capacitor sits across the same voltage. Stored energy?' },
    { a: 'trafo', b: 'sigac-enerji', k: 'V', tr: '{A.V1} şebekeye bağlı transformatörde {A.N1} birincil, {A.N2} ikincil sarım var; çıkışa {B.C} sığaç bağlanıyor. Sığacın enerjisi?', en: 'A transformer on {A.V1} mains has {A.N1}/{A.N2} turns; a {B.C} capacitor is on the output. Its energy?' },
    { a: 'dogal-frekans', b: 'zorlanmis', k: 'wn', tr: '{A.k} yay sabitli yaya {A.m} kütle bağlı; {B.F0} genlikli kuvvet {B.w} frekansla uygulanıyor. Kararlı genlik?', en: 'A {A.m} mass on a {A.k} spring is driven by {B.F0} at {B.w}. Steady amplitude?', esle: function (vA, vB) { vB.m = vA.m; } },
    { a: 'ortalama', b: 'z-skor', k: 'x', tr: 'Bir öğrencinin üç sınavı {A.x1}, {A.x2}, {A.x3}. Sınıf ortalaması {B.mu}, standart sapma {B.sg} ise öğrencinin ortalamasının z-skoru?', en: 'A student scored {A.x1}, {A.x2}, {A.x3}. Class mean {B.mu}, SD {B.sg}. z-score of the student’s average?' },
    { a: 'bagimsiz-olay', b: 'binom', k: 'p', tr: 'Bir ürün iki bağımsız testten {A.pa} ve {A.pb} olasılıkla geçiyor. {B.n} üründen tam {B.k} tanesinin ikisini de geçme olasılığı?', en: 'A product passes two independent tests with {A.pa} and {A.pb}. Probability exactly {B.k} of {B.n} pass both?' },
    { a: 'serbest-dusme', b: 'konum', k: 't', tr: 'Bir taş {A.h} yükseklikten bırakılıyor (g = {A.g}). Aynı sürede {B.x0} konumundan {B.v0} hızla, {B.a} ivmeyle giden araba nereye varır?', en: 'A stone falls from {A.h} (g = {A.g}). In the same time, where does a car starting at {B.x0} with {B.v0} and {B.a} end up?' },
    { a: 'vektor-boy', b: 'vektorel', k: 'u', tr: 'u = ⟨{A.a}, {A.b}, {A.c}⟩ vektörü ile uzunluğu {B.v} olan v arasındaki açı {B.th}. u × v’nin büyüklüğü?', en: 'u = ⟨{A.a}, {A.b}, {A.c}⟩ and v (length {B.v}) meet at {B.th}. Magnitude of u × v?' },
    { a: 'cramer2', b: 'dondurme', k: 'x', tr: 'Sistem: {A.a}x + {A.b}y = {A.e}, {A.c}x + {A.d}y = {A.g}. Çözümün x’i ile (x, {B.y}) noktası {B.th} döndürülüyor. Yeni x′?', en: 'System: {A.a}x + {A.b}y = {A.e}, {A.c}x + {A.d}y = {A.g}. The point (x, {B.y}) using its solution x is rotated by {B.th}. New x′?' },
    { a: 'karekok-newton', b: 'karekok-newton', k: 'x0', tr: '√{A.a} için Newton yöntemine {A.x0} tahminiyle başla ve iki adım uygula. x₂ kaçtır?', en: 'Start Newton’s method for √{A.a} at {A.x0} and take two steps. What is x₂?', esle: function (vA, vB) { vB.a = vA.a; } },
    { a: 'sarkac', b: 'ortalama-hiz', k: 'dt', tr: '{A.L} uzunluğunda sarkacın bir periyodu boyunca (g = {A.g}) bir böcek {B.dx} yürüyor. Ortalama hızı?', en: 'During one period of a {A.L} pendulum (g = {A.g}), a bug walks {B.dx}. Its average speed?' }
  ];
  ZINCIR.forEach(function (z) { var fa = bul(z.a); z.ders = fa ? fa.d : null; });

  /* ---------- soru üretimi ---------- */
  function genQ(g, sev) { if (!g) return null; return { tip: 'gen', sev: sev || g.sev, g: g, f: bul(g.f), metin: g.metin, mc: g.mc, dogruI: g.dogruI, dogru: g.dogru, birim: g.birim || '', s: g.s || '?' }; }
  function uret(ders, konu, seviye) {
    var hes = FO.formuller.filter(function (f) { return f.o && f.d === ders && (!konu || f.k === konu); }), U = W.FORMULO_URET;
    if (U) {
      var gens = U.havuz(ders, konu, seviye);
      if (gens.length && (!hes.length || Math.random() < .5)) return genQ(U.uret(rast(gens)), seviye);
      if (seviye === 'orta' && hes.length && Math.random() < .3) { var oq = genQ(U.oranSoru(rast(hes)), 'orta'); if (oq) return oq; }
      if (!hes.length) { var hepsi = U.havuz(ders, konu); if (hepsi.length) { var gq = genQ(U.uret(rast(hepsi)), seviye); gq.not = T('seviyeYok'); return gq; } }
    }
    if (!hes.length) return { yok: true };
    if (seviye === 'zor') {
      var zs = ZINCIR.filter(function (z) { var fa = bul(z.a), fb = bul(z.b); return z.ders === ders && (!konu || fa.k === konu || fb.k === konu); });
      if (zs.length) for (var deneme = 0; deneme < 40; deneme++) { var q = zincir(rast(zs)); if (q) return q; }
      var o = uret(ders, konu, 'orta'); o.not = T('zincirYok'); return o;
    }
    for (var t = 0; t < 60; t++) {
      var f = rast(hes), v = degerler(f); if (!gecerli(f, v)) continue;
      if (seviye === 'orta') {
        var adaylar = Object.keys(f.v).filter(function (k) { return f.v[k].max > f.v[k].min && monoton(f, v, k); });
        if (!adaylar.length) continue;
        var k = rast(adaylar), hedef = f.o.f(v), bulunan = ikiye(f, v, k, hedef);
        if (Math.abs(bulunan - v[k]) > Math.max(Math.abs(v[k]) * 0.01, 1e-9)) continue;
        return { tip: 'orta', f: f, v: v, k: k, hedef: hedef, dogru: v[k], birim: f.v[k].u, s: sembol(f, k) };
      }
      return { tip: 'kolay', f: f, v: v, dogru: f.o.f(v), birim: f.o.u, s: FO.os(f.o.s) };
    }
    if (seviye === 'orta') { var k2 = uret(ders, konu, 'kolay'); if (!k2.yok) k2.not = T('ortaYok'); return k2; }
    return { yok: true };
  }
  function zincir(z) {
    var fa = bul(z.a), fb = bul(z.b), va = degerler(fa), vb = degerler(fb);
    if (!gecerli(fa, va)) return null; var ara = fa.o.f(va); vb[z.k] = ara; if (z.esle) z.esle(va, vb);
    if (!gecerli(fb, vb)) return null;
    return { tip: 'zor', z: z, f: fb, fa: fa, va: va, vb: vb, ara: ara, dogru: fb.o.f(vb), birim: fb.o.u, s: esc(fb.o.s) };
  }
  function soruMetni(q) {
    if (q.tip === 'gen') return q.metin;
    if (q.tip === 'zor') {
      var m = (dil() === 'en' ? q.z.en : q.z.tr).replace(/\{([AB])\.(\w+)\}/g, function (_, h, k) { var f = h === 'A' ? q.fa : q.f, v = h === 'A' ? q.va : q.vb; return '<b>' + esc(birimli(f, k, v[k])) + '</b>'; });
      return m;
    }
    var f = q.f, b = baglamDoldur(f, q.v, q.tip === 'orta' ? q.k : null), son;
    if (q.tip === 'orta') son = T('soruO')(ad(f.o), '<b>' + esc(sayi(q.hedef) + (f.o.u ? ' ' + f.o.u : '')) + '</b>', ad(f.v[q.k]) + ' (' + sembol(f, q.k) + ')');
    else son = T('soruK')(ad(f.o) + ' (' + FO.os(f.o.s) + ')');
    if (!/^.[’']/.test(son)) son = son.charAt(0).toLocaleUpperCase(dil() === 'en' ? 'en' : 'tr') + son.slice(1);
    return (b || T('genel')) + ' ' + son;
  }
  function verilenler(q) { if (q.tip === 'gen') return ''; if (q.tip === 'zor') return verilenHTML(q.fa, q.va) + verilenHTML(q.f, q.vb, q.z.k, q.z.esle ? q.va : null); return verilenHTML(q.f, q.v, q.tip === 'orta' ? q.k : null) + (q.tip === 'orta' ? '<span><i class="fq-s">' + FO.os(q.f.o.s) + '</i> = ' + esc(sayi(q.hedef) + ' ' + q.f.o.u) + '</span>' : ''); }
  function ipucu(q, n) {
    if (q.tip === 'gen') return '<div class="fq-ip-ic">' + q.g.ip[n - 1] + '</div>';
    if (q.tip === 'zor') return n === 1 ? '<p>' + esc(T('zincirIp')) + '</p><p><b>' + esc(ad(q.fa)) + '</b> → <b>' + esc(ad(q.f)) + '</b></p>' : '<p>' + esc(T('ip2')) + '</p><div class="fo-f fq-f">' + yerineHTML(q.fa, q.va) + '</div>';
    if (n === 1) return '<p>' + esc(T('ip1')) + ' <b>' + esc(ad(q.f)) + '</b></p><div class="fo-f fq-f">' + q.f.h + '</div>' + (q.tip === 'orta' ? '<p>' + esc(T('tersIp')) + '</p>' : '');
    var v = q.tip === 'orta' ? Object.assign({}, q.v, (function () { var o = {}; o[q.k] = null; return o; })()) : q.v;
    return '<p>' + esc(T('ip2')) + '</p><div class="fo-f fq-f">' + yerineHTML(q.f, v) + '</div>';
  }
  function cozum(q) { return '<ol class="fq-cozum">' + adimlar(q).map(function (a) { return '<li><b>' + esc(a.b) + '</b><div>' + a.h + '</div></li>'; }).join('') + '</ol>'; }
  function cevapHTML(q) { return q.mc ? q.mc[q.dogruI] : esc(sayi(q.dogru) + (q.birim ? ' ' + q.birim : '')); }
  /* çözüm adımları: [{b: başlık, h: html}] (tahtada da satır satır yazılır) */
  function adimlar(q) {
    var s = [], sat = function (b, h) { s.push({ b: b, h: h }); };
    if (q.tip === 'gen') return q.g.cozum;
    if (q.tip === 'zor') {
      sat(T('verilen'), '<p class="fq-ver">' + verilenler(q) + '</p>');
      sat(T('adim1') + ' · ' + ad(q.fa), '<div class="fo-f fq-f">' + q.fa.h + '</div>' + (siSatir(q.fa, q.va) ? '<p class="fq-ver">' + siSatir(q.fa, q.va) + '</p>' : '') + '<div class="fo-f fq-f">' + yerineHTML(q.fa, q.va) + '</div><p>' + FO.os(q.fa.o.s) + ' = <b>' + esc(sayi(q.ara) + ' ' + q.fa.o.u) + '</b></p>');
      sat(T('adim2') + ' · ' + ad(q.f), '<div class="fo-f fq-f">' + q.f.h + '</div><div class="fo-f fq-f">' + yerineHTML(q.f, q.vb) + '</div>');
      sat(T('sonuc'), '<p class="fq-son">' + q.s + ' = <b>' + esc(sayi(q.dogru) + ' ' + q.birim) + '</b></p>');
    } else {
      sat(T('verilen'), '<p class="fq-ver">' + verilenler(q) + '</p><p>' + esc(T('istenen')) + ': <i class="fq-s">' + q.s + '</i></p>');
      sat(T('formul'), '<div class="fo-f fq-f">' + q.f.h + '</div>');
      var si = siSatir(q.f, q.v); if (si) sat(T('si'), '<p class="fq-ver">' + si + '</p>');
      if (q.tip === 'orta') {
        sat(T('ters'), '<p>' + FO.os(q.f.o.s) + '(' + q.s + ') = ' + esc(sayi(q.hedef)) + ' ⟹ ' + q.s + ' = <b>' + esc(birimli(q.f, q.k, q.dogru)) + '</b></p>');
        sat(T('kontrolA'), '<div class="fo-f fq-f">' + yerineHTML(q.f, q.v) + '</div><p>= ' + esc(sayi(q.f.o.f(q.v)) + ' ' + q.f.o.u) + ' ✓</p>');
      } else {
        sat(T('yerine'), '<div class="fo-f fq-f">' + yerineHTML(q.f, q.v) + '</div>');
        sat(T('sonuc'), '<p class="fq-son">' + q.s + ' = <b>' + esc(sayi(q.dogru) + ' ' + q.birim) + '</b></p>');
      }
    }
    return s;
  }
  function dogruMu(x, d) { return isFinite(x) && Math.abs(x - d) <= Math.max(Math.abs(d) * 0.02, 1e-9); }
  function oku(s) { s = String(s).trim().replace(/\s/g, '').replace(/×10\^?/, 'e').replace(/,/g, '.'); return parseFloat(s); }

  /* ---------- hata defteri ---------- */
  function hataEkle(q, cvp) {
    var h = al('hata', []); h.unshift({ id: q.f.id, d: q.f.d, tip: q.tip, sev: q.sev, g: q.g ? q.g.g : null, z: q.z ? q.z.a + '>' + q.z.b : null, cvpH: q.mc ? cvp : esc(String(cvp)), dogruH: cevapHTML(q), metin: soruMetni(q), ts: Date.now() });
    koy('hata', h.slice(0, 60));
  }
  function hataHTML() {
    var h = al('hata', []);
    var bas = '<section class="fq-hata" data-fq-hata><h2 class="fq-h2">' + esc(T('hata')) + ' <span>' + h.length + '</span></h2>';
    if (!h.length) return bas + '<p class="fq-bos">' + esc(T('hataBos')) + '</p></section>';
    return bas + '<ul>' + h.map(function (x, n) {
      var f = bul(x.id), d = f && FO.dersler.filter(function (y) { return y.id === x.d; })[0]; if (!f || !d) return '';
      return '<li style="--c:' + d.renk + '"><small>' + esc(d.kod) + ' · ' + esc(ad(f)) + ' · ' + esc(T(x.sev || x.tip)) + '</small><p>' + x.metin + '</p><p class="fq-hata-c">✗ ' + (x.cvpH != null ? x.cvpH : esc(String(x.cvp))) + ' · ✓ <b>' + (x.dogruH || esc(sayi(x.dogru) + ' ' + x.birim)) + '</b></p>' +
        '<div><a class="fo-btn fo-btn-ince" href="#/' + d.id + '" data-fq-tekrar="' + n + '">' + esc(T('tekrar')) + '</a><button type="button" class="fo-btn fo-btn-ince" data-fq-sil="' + n + '">' + esc(T('sil')) + '</button></div></li>';
    }).join('') + '</ul></section>';
  }
  function hataKur(kok) {
    kok.querySelectorAll('[data-fq-sil]').forEach(function (b) { b.addEventListener('click', function () { var h = al('hata', []); h.splice(+b.getAttribute('data-fq-sil'), 1); koy('hata', h); var s = kok.querySelector('[data-fq-hata]'); s.outerHTML = hataHTML(); hataKur(kok); }); });
    kok.querySelectorAll('[data-fq-tekrar]').forEach(function (b) { b.addEventListener('click', function () { var h = al('hata', []), x = h[+b.getAttribute('data-fq-tekrar')]; if (x) koy('tekrar', { id: x.id, tip: x.tip, sev: x.sev, g: x.g }); }); });
  }

  /* ---------- panel ---------- */
  function panelHTML(d) {
    var U = W.FORMULO_URET, hes = function (k) { return FO.formuller.filter(function (f) { return f.o && f.d === d.id && (!k || f.k === k); }).length + (U ? U.havuz(d.id, k).length : 0); };
    return '<div class="fq" data-fq><div class="fq-ust"><div class="fq-sev" role="radiogroup" aria-label="' + esc(T('kolay')) + '/' + esc(T('zor')) + '">' +
      ['kolay', 'orta', 'zor'].map(function (s, n) { return '<button type="button" role="radio" data-fq-sev="' + s + '" aria-checked="' + (n === 0) + '">' + esc(T(s)) + '</button>'; }).join('') + '</div>' +
      '<label class="fq-konu"><span>' + esc(T('konu')) + '</span><select data-fq-konu><option value="">' + esc(T('hepsi')) + '</option>' + d.konular.filter(function (k) { return hes(k.id); }).map(function (k) { return '<option value="' + k.id + '">' + esc(ad(k)) + '</option>'; }).join('') + '</select></label>' +
      '<span class="fq-puan" data-fq-puan></span></div>' + (U ? '<p class="fq-sayac">' + T('sayac')(buyuk(U.sayac(d.id))) + '</p>' : '') +
      '<div class="fq-kart"><div class="fq-acadia"><span class="fq-acd" data-fq-acd>' + W.FO_ACADIA({ mood: 'mutlu', pose: 'selam', size: 64 }) + '</span><p class="fq-balon" data-fq-balon></p></div>' +
      '<div class="fq-govde" data-fq-govde></div></div></div>';
  }
  function panelKur(kok, d) {
    var seviye = 'kolay', konu = '', q = null, ipN = 0, cevaplandi = false, skor = al('skor', {}), sk = skor[d.id] || { d: 0, t: 0, s: 0 };
    var govde = kok.querySelector('[data-fq-govde]'), balon = kok.querySelector('[data-fq-balon]'), acd = kok.querySelector('[data-fq-acd]');
    function acadia(mood, pose, metin) { if (W.AcadiaKit && acd) acd.innerHTML = W.FO_ACADIA({ mood: mood, pose: pose, size: 64 }); balon.textContent = metin; balon.classList.remove('fq-yeni'); void balon.offsetWidth; balon.classList.add('fq-yeni'); }
    function puanYaz() { kok.querySelector('[data-fq-puan]').innerHTML = '<b>' + sk.d + '/' + sk.t + '</b> ' + esc(T('puan')) + (sk.s > 1 ? ' · <b>' + sk.s + '</b> ' + esc(T('seri')) : ''); }
    function yeni(zorla) {
      q = zorla || uret(d.id, konu, seviye); ipN = 0; cevaplandi = false;
      if (q.yok) { govde.innerHTML = '<p class="fq-bos">' + esc(T('yok')) + '</p>'; return; }
      var f = q.f || FO.formuller.filter(function (x) { return x.d === d.id; })[0]; if (!q.f) q.f = f; var k = FO.dersler.filter(function (x) { return x.id === f.d; })[0].konular.filter(function (x) { return x.id === f.k; })[0];
      govde.innerHTML = '<p class="fq-etiket"><span class="fq-sev-e fq-' + (q.sev || q.tip) + '">' + esc(T(q.sev || q.tip)) + '</span>' + esc(ad(k)) + (q.tip === 'zor' ? ' · ' + esc(ad(q.fa)) + ' → ' + esc(ad(f)) : '') + '</p>' + (q.not ? '<p class="fq-not">' + esc(q.not) + '</p>' : '') +
        '<p class="fq-metin">' + soruMetni(q) + '</p><p class="fq-ver">' + verilenler(q) + '</p>' +
        (q.mc ? '<div class="fq-siklar" role="group">' + q.mc.map(function (m, i) { return '<button type="button" class="fq-sik" data-fq-sik="' + i + '"><i>' + 'ABCD'[i] + '</i><span>' + m + '</span></button>'; }).join('') + '</div>' : '') +
        '<form class="fq-form">' + (q.mc ? '' : '<label><span class="fq-s">' + q.s + ' =</span><input type="text" inputmode="decimal" autocomplete="off" aria-label="' + esc(T('cevap')) + '"><em>' + esc(q.birim) + '</em></label>') +
        (q.mc ? '' : '<button type="submit" class="fo-btn">' + esc(T('kontrol')) + '</button>') + '<button type="button" class="fo-btn fo-btn-ince" data-fq-ip>' + esc(T('ipucu')) + ' <i>0/2</i></button><button type="button" class="fo-btn fo-btn-ince" data-fq-coz>' + esc(T('cozum')) + '</button><button type="button" class="fo-btn fo-btn-ince" data-fq-yeni>' + esc(T('yeni')) + ' ↻</button></form>' +
        '<p class="fq-c" data-fq-c aria-live="polite"></p><div class="fq-ipler" data-fq-ipler></div><div data-fq-cozum></div>';
      acadia('mutlu', 'selam', rast(T('acadia')));
      var form = govde.querySelector('form'), inp = form.querySelector('input'), c = govde.querySelector('[data-fq-c]');
      function sonuc(ok, cvp) {
        c.className = 'fq-c ' + (ok ? 'fo-ok' : 'fo-no'); c.innerHTML = ok ? '✓ ' + esc(T('dogru')) : '✗ ' + esc(T('yanlis')) + ': <b>' + cevapHTML(q) + '</b>';
        if (!cevaplandi) { cevaplandi = true; sk.t++; if (ok) { sk.d++; sk.s++; } else { sk.s = 0; hataEkle(q, cvp); } skor[d.id] = sk; koy('skor', skor); puanYaz(); if (ok) D.dispatchEvent(new CustomEvent('formulo:dogru', { detail: { id: q.f.id, d: q.f.d, sev: q.sev || q.tip, kaynak: 'havuz' } })); }   /* rozet ve seri: formulo-plus.js */
        if (ok) acadia('kutlama', 'zipla', rast(T('tebrik'))); else { acadia('dusunuyor', 'dusun', rast(T('teselli'))); goster(); }
        koy('son', { d: q.f.d, k: q.f.k, id: q.f.id, ts: Date.now() });
      }
      form.addEventListener('submit', function (e) {
        e.preventDefault(); if (!inp) return; var x = oku(inp.value); if (!isFinite(x)) { inp.focus(); return; }
        sonuc(dogruMu(x, q.dogru), inp.value);
      });
      govde.querySelectorAll('[data-fq-sik]').forEach(function (b) { b.addEventListener('click', function () {
        var i = +b.getAttribute('data-fq-sik'), ok = i === q.dogruI;
        govde.querySelectorAll('[data-fq-sik]').forEach(function (x, j) { x.classList.toggle('fq-dogru', j === q.dogruI); if (j === i && !ok) x.classList.add('fq-yanlis'); x.disabled = true; });
        sonuc(ok, q.mc[i]);
      }); });
      govde.querySelector('[data-fq-ip]').addEventListener('click', function () {
        if (ipN >= 2) return; ipN++; this.querySelector('i').textContent = ipN + '/2';
        govde.querySelector('[data-fq-ipler]').insertAdjacentHTML('beforeend', '<div class="fq-ip"><b>' + esc(T('ipucu')) + ' ' + ipN + '</b>' + ipucu(q, ipN) + '</div>');
        acadia('odakli', 'isaret', ipN === 1 ? T('ip1') : T('ip2'));
      });
      govde.querySelector('[data-fq-coz]').addEventListener('click', goster);
      govde.querySelector('[data-fq-yeni]').addEventListener('click', function () { yeni(); });
      function goster() { var z = govde.querySelector('[data-fq-cozum]'); if (!z.innerHTML) z.innerHTML = cozum(q); }
    }
    kok.querySelectorAll('[data-fq-sev]').forEach(function (b) { b.addEventListener('click', function () { seviye = b.getAttribute('data-fq-sev'); kok.querySelectorAll('[data-fq-sev]').forEach(function (x) { x.setAttribute('aria-checked', x === b); }); yeni(); }); });
    kok.querySelector('[data-fq-konu]').addEventListener('change', function () { konu = this.value; yeni(); });
    puanYaz();
    /* hata defterinden "benzerini çöz" ile gelindiyse */
    var tk = al('tekrar', null), ilk = null;
    if (tk && tk.g && W.FORMULO_URET) { koy('tekrar', null); var gg = W.FORMULO_URET.G.filter(function (x) { return x.id === tk.g; })[0]; if (gg && gg.d === d.id) { seviye = gg.sev; kok.querySelectorAll('[data-fq-sev]').forEach(function (x) { x.setAttribute('aria-checked', x.getAttribute('data-fq-sev') === seviye); }); ilk = genQ(W.FORMULO_URET.uret(gg)); } tk = null; }
    if (tk) { koy('tekrar', null); var tf = bul(tk.id); if (tf && tf.d === d.id) { seviye = tk.tip === 'zor' ? 'zor' : tk.tip; kok.querySelectorAll('[data-fq-sev]').forEach(function (x) { x.setAttribute('aria-checked', x.getAttribute('data-fq-sev') === seviye); }); if (tk.tip === 'kolay') { var v = degerler(tf); if (gecerli(tf, v)) ilk = { tip: 'kolay', f: tf, v: v, dogru: tf.o.f(v), birim: tf.o.u, s: FO.os(tf.o.s) }; } } }
    yeni(ilk);
    return { tekrarVar: !!tk };
  }

  W.FORMULO_SORU = { uret: uret, panelHTML: panelHTML, panelKur: panelKur, hataHTML: hataHTML, hataKur: hataKur, ZINCIR: ZINCIR, monoton: monoton, ikiye: ikiye, soruMetni: soruMetni, cozum: cozum, adimlar: adimlar, kolayIcin: function (f) { for (var i = 0; i < 30; i++) { var v = degerler(f); if (gecerli(f, v)) return { tip: 'kolay', f: f, v: v, dogru: f.o.f(v), birim: f.o.u, s: FO.os(f.o.s) }; } return null; }, cevapHTML: cevapHTML, hataEkle: hataEkle, genQ: genQ, verilenler: verilenler, dogruMu: dogruMu, oku: oku };
})(window);
