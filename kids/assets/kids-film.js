/* ==========================================================================
   ACADEX KIDS · tanıtım sayfası: "Bir günün hikâyesi" filmi ve üç bakış (kids/assets/kids-film.js), 15.11.2026
   Film: bölüm sabitlenir (sticky), kaydırma altı perdelik bir zaman çizgisini ileri sarar.
     0 Sınıfta: öğretmen tabletinde Colours seçilir      3 Harita: günün konusu parlar, Oyna
     1 Evde: "Kim oynuyor?", "Sen Ali misin?"            4 Oyun: sarı balon patlar, dört adım
     2 Yolculuk: kamera ekrana dalar, roketle uçuş       5 Ertesi sabah: öğretmen tablosu + veli kartı
   Cihazın içindeki ekranlar resim değil, uygulamanın kendi çizimleriyle (kids-ciz.js) kurulur.
   Her perdede yerel ilerleme (--t) ve dört evre (--k1..--k4) CSS'e verilir; hareket CSS'tedir.
   Fare/telefon eğimi (--mx, --my) sahne katmanlarını hafifçe kaydırır (kids-scroll.js verir).
   Hareketi azalt açıksa film sabitlenmez: perdeler alt alta, her ekran son hâliyle görünür.
   Üç bakış: Çocuk / Öğretmen / Veli sekmeleri (ARIA sekme düzeni, ok tuşları).
   15.11.2026 (3): yaş dünyaları üst üste yığılan kartlar (örnek ekranlarla), konular aşağı kaydırdıkça
   yana akan adalar şeridi, fiyat kartı yerine "Kreşinize özel teklif" sahnesi (fiyat yazılmaz).
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, C = W.KIDS_CIZ, V = W.KIDS_VERI;
  var SAKIN = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var N = 6, bolum, yap, sahne, cubuk, bolumler, noktalar, son = -1, bekliyor = false;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function cl(x) { return Math.max(0, Math.min(1, x)); }
  function seg(t, a, b) { return cl((t - a) / (b - a)); }
  function yumusak(u) { return u * u * (3 - 2 * u); }
  function renk(id) { var r = (V.RENK || []).filter(function (x) { return x.id === id; })[0]; return r ? r.hex : '#FFD23F'; }
  function konu(id) { return (V.KONU || []).filter(function (k) { return k.id === id; })[0] || V.KONU[0]; }
  var OGR = [['Ali', 'ayi', 4], ['Defne', 'tavsan', 0], ['Zeynep', 'kedi', 6], ['Kerem', 'civciv', 2], ['Elif', 'panda', 7], ['Mert', 'kurbaga', 3]];
  var parmak = '<i class="kf-parmak"><i></i></i>';

  /* ---------- cihazdaki ekranlar ---------- */
  function ekranOgretmen() {
    var konular = ['colours', 'numbers', 'animals', 'food'].map(konu);
    return '<div class="kf-e kf-e0"><div class="kf-ust-cubuk"><b>Papatyalar</b><span>Bugün · Salı</span></div>' +
      '<p class="kf-e-baslik">Bugünün konusu</p><div class="kf-konular">' + konular.map(function (k, i) {
        return '<span class="kf-konu' + (i === 0 ? ' kf-hedef' : '') + '" style="--r:' + k.renk + '"><i>' + C.simge(k.simge) + '</i><b lang="en">' + esc(k.en) + '</b><small>' + esc(k.tr) + '</small></span>';
      }).join('') + '</div>' +
      '<div class="kf-hafta">' + ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'].map(function (g, i) { return '<span' + (i === 1 ? ' class="kf-bugun"' : '') + '><small>' + g + '</small><i style="--r:' + (i === 0 ? konu('numbers').renk : i === 1 ? konu('colours').renk : '#EDE6D2') + '"></i></span>'; }).join('') + '</div>' +
      '<p class="kf-tost">' + C.simge('tik') + ' Bugünün konusu: <b lang="en">Colours</b></p>' + parmak + '</div>';
  }
  function ekranKim() {
    return '<div class="kf-e kf-e1"><div class="kf-balon-acd"><i>' + C.acadia({ mood: 'mutlu' }) + '</i><span>Kim oynuyor?</span></div><div class="kf-yuzler">' +
      OGR.map(function (o, i) { return '<span class="kf-yuz' + (i === 0 ? ' kf-hedef' : '') + '">' + C.avatar(o[1], o[2]) + '<b>' + o[0] + '</b></span>'; }).join('') + '</div>' +
      '<div class="kf-onay"><i>' + C.avatar('ayi', 4) + '</i><b>Sen Ali misin?</b><span class="kf-onay-d"><em>✗</em><em class="kf-evet">✓</em></span></div>' + parmak + '</div>';
  }
  function ekranUzay() {
    var y = ''; for (var i = 0; i < 28; i++) y += '<i style="--a:' + ((i * 137.5) % 360).toFixed(1) + 'deg;--d:' + (-(i % 7) * 0.13).toFixed(2) + 's"></i>';
    return '<div class="kf-e kf-e2"><span class="kf-warp">' + y + '</span></div>';
  }
  function ekranHarita() {
    var k = konu('colours'), adalar = ['colours', 'numbers', 'animals', 'family'].map(konu);
    return '<div class="kf-e kf-e3"><div class="kf-ust-cubuk kf-cocuk-cubuk"><i>' + C.avatar('ayi', 4) + '</i><b>Ali</b><span class="kf-yildiz">' + C.simge('yildiz') + '<b>12</b></span></div>' +
      '<div class="kf-gunun"><i>' + C.acadia({ mood: 'kutlama' }) + '</i><span><small>Bugünün konusu</small><b lang="en">' + esc(k.en) + '</b></span><em class="kf-hedef">Oyna</em></div>' +
      '<div class="kf-adalar">' + adalar.map(function (a, i) { return '<span' + (i === 0 ? ' class="kf-ada-bugun"' : '') + '>' + C.ada(a.renk, a.simge, false) + '<b lang="en">' + esc(a.en) + '</b></span>'; }).join('') + '</div>' + parmak + '</div>';
  }
  function ekranOyun() {
    return '<div class="kf-e kf-e4"><div class="kf-adim">' + ['İzle', 'Dinle', 'Oyna', 'Söyle'].map(function (a, i) { return '<span data-a="' + i + '"><i>' + (i + 1) + '</i>' + a + '</span>'; }).join('') + '</div>' +
      '<p class="kf-yonerge" lang="en">Pop the <b style="--r:' + renk('yellow') + '">yellow</b> balloon!</p>' +
      '<div class="kf-balonlar"><span>' + C.balon(renk('red')) + '</span><span class="kf-hedef">' + C.balon(renk('yellow')) + '<i class="kf-patla"></i></span><span>' + C.balon(renk('blue')) + '</span></div>' +
      '<p class="kf-aferin" lang="en">' + C.simge('yildiz') + ' Well done!</p>' + parmak + '</div>';
  }
  function ekranSabah() {
    var satir = OGR.slice(0, 5).map(function (o, i) { var y = [0.92, 0.7, 0.85, 0.4, 0.62][i]; return '<li><i>' + C.avatar(o[1], o[2]) + '</i><b>' + o[0] + '</b><span class="kf-bar"><em style="--y:' + y + '"></em></span></li>'; }).join('');
    return '<div class="kf-e kf-e5"><div class="kf-ust-cubuk"><b>Papatyalar · dün</b><span lang="en">Colours</span></div><ul class="kf-tablo">' + satir + '</ul></div>';
  }

  /* ---------- sahne ---------- */
  function sahneHTML() {
    var yildiz = ''; for (var i = 0; i < 40; i++) yildiz += '<i style="left:' + ((i * 37.7) % 100).toFixed(1) + '%;top:' + ((i * 61.3) % 100).toFixed(1) + '%;--d:' + ((i % 7) * 0.4).toFixed(1) + 's"></i>';
    return '<div class="kf-bg kf-bg-sinif"><i class="kf-pencere"><i class="kf-gunes"></i></i><i class="kf-tahta"><b>ABC</b><span>' + C.simge('gokkusagi') + '</span></i><i class="kf-zemin"></i></div>' +
      '<div class="kf-bg kf-bg-ev"><i class="kf-pencere kf-aksam"><i class="kf-gunes"></i></i><i class="kf-lamba"></i><i class="kf-koltuk"></i><i class="kf-zemin"></i></div>' +
      '<div class="kf-bg kf-bg-uzay"><span class="kf-yildizlar">' + yildiz + '</span><i class="kf-nebula"></i></div>' +
      '<div class="kf-bg kf-bg-dunya"><span class="kf-k kf-k1">' + C.bulut() + '</span><span class="kf-k kf-k2">' + C.bulut() + '</span><span class="kf-k kf-k3">' + C.ada(konu('animals').renk, konu('animals').simge, false) + '</span><span class="kf-k kf-k4">' + C.ada(konu('food').renk, konu('food').simge, false) + '</span></div>' +
      '<div class="kf-bg kf-bg-sabah"><i class="kf-pencere"><i class="kf-gunes"></i></i><i class="kf-tahta"><b lang="en">red · blue</b><span>' + C.simge('yildiz') + '</span></i><i class="kf-zemin"></i></div>' +
      '<div class="kf-cihaz" data-kf-cihaz><div class="kf-cerceve"><div class="kf-ekran">' + ekranOgretmen() + ekranKim() + ekranUzay() + ekranHarita() + ekranOyun() + ekranSabah() + '</div></div></div>' +
      '<div class="kf-roket"><span class="kf-roket-c">' + roket() + '<i>' + C.avatar('ayi', 4) + '</i></span><span class="kf-roket-acd">' + C.acadia({ mood: 'kutlama' }) + '</span></div>' +
      '<div class="kf-veli"><span class="kf-veli-bas">' + C.simge('veli') + '<b>Papatyalar sınıfı</b></span><p><b>Bugün ne öğrendik?</b><span lang="en">red · blue · yellow · green</span></p><p class="kf-veli-s">Evde sorun: “Domates ne renk?”</p></div>';
  }
  function roket() {
    var M = '#23304D';
    return '<svg viewBox="0 0 120 200" aria-hidden="true"><g class="kf-alev"><path d="M44 160 q16 48 16 40 q0 8 16 -40 z" fill="#FFB020"/><path d="M50 160 q10 30 10 26 q0 4 10 -26 z" fill="#FFF3B0"/></g>' +
      '<path d="M34 120 l-22 36 l26 -6 z M86 120 l22 36 l-26 -6 z" fill="#E5484D" stroke="' + M + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<path d="M60 6 q34 30 30 120 q-2 26 -10 36 h-40 q-8 -10 -10 -36 q-4 -90 30 -120 z" fill="#fff" stroke="' + M + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<path d="M60 6 q18 16 25 44 h-50 q7 -28 25 -44 z" fill="#E5484D" stroke="' + M + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<path d="M40 162 h40 l-4 10 h-32 z" fill="#8E7CF0" stroke="' + M + '" stroke-width="3.5" stroke-linejoin="round"/><circle cx="60" cy="78" r="25" fill="#CDEBFF" stroke="' + M + '" stroke-width="4"/></svg>';
  }

  /* ---------- kaydırma ---------- */
  function ilerleme() { var r = bolum.getBoundingClientRect(), yol = r.height - W.innerHeight; return yol > 0 ? cl(-r.top / yol) : 0; }
  function ciz() {
    bekliyor = false;
    if (!bolum || D.getElementById('kl-sayfa').hidden) return;
    var p = ilerleme(), x = p * N, i = Math.min(N - 1, Math.floor(x)), t = Math.min(1, x - i);
    if (cubuk) cubuk.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    yap.style.setProperty('--t', t.toFixed(3));
    yap.style.setProperty('--k1', yumusak(seg(t, 0.08, 0.34)).toFixed(3));
    yap.style.setProperty('--k2', yumusak(seg(t, 0.34, 0.52)).toFixed(3));
    yap.style.setProperty('--k3', yumusak(seg(t, 0.52, 0.72)).toFixed(3));
    yap.style.setProperty('--k4', yumusak(seg(t, 0.72, 0.94)).toFixed(3));
    ['a1', 'a2', 'a3'].forEach(function (a, n) { yap.classList.toggle('kf-' + a, t >= [0.34, 0.52, 0.72][n]); });
    if (i === son) return;
    son = i; perde(i);
  }
  function perde(i) {
    yap.setAttribute('data-perde', i);
    bolumler.forEach(function (b, n) { b.classList.toggle('kf-aktif', n === i); b.classList.toggle('kf-gecti', n < i); b.setAttribute('aria-hidden', n === i || SAKIN ? 'false' : 'true'); });
    noktalar.forEach(function (b, n) { b.classList.toggle('kf-aktif', n === i); if (n === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
  }
  function git(n) {
    var r = bolum.getBoundingClientRect(), yol = r.height - W.innerHeight, hedef = W.scrollY + r.top + yol * (n + 0.62) / N;
    if (W.KIDS_SCROLL && W.KIDS_SCROLL.kaydir) W.KIDS_SCROLL.kaydir(hedef); else W.scrollTo({ top: hedef, behavior: SAKIN ? 'auto' : 'smooth' });
  }
  function iste() { if (!bekliyor) { bekliyor = true; W.requestAnimationFrame(ciz); } }

  /* ---------- üç bakış ---------- */
  function bakisGorsel(tur) {
    if (tur === 'cocuk') return '<span class="kb-g-ada">' + C.ada(konu('colours').renk, konu('colours').simge, false) + '</span><span class="kb-g-av">' + C.avatarGiy('kedi', { bas: (C.GIYSI || [])[0] }, 1) + '</span>' +
      '<span class="kb-g-yz kb-yz1">' + C.simge('yildiz') + '</span><span class="kb-g-yz kb-yz2">' + C.simge('yildiz') + '</span><span class="kb-g-yz kb-yz3">' + C.simge('yildiz') + '</span>';
    if (tur === 'ogretmen') return '<span class="kb-g-tablet"><b>Papatyalar</b>' + OGR.slice(0, 4).map(function (o, i) { return '<span style="--i:' + i + '"><i>' + C.avatar(o[1], o[2]) + '</i><em>' + o[0] + '</em><u style="--y:' + [0.9, 0.6, 0.8, 0.45][i] + '"></u></span>'; }).join('') + '</span><span class="kb-g-acd">' + C.acadia({ mood: 'mutlu', pose: 'isaret' }) + '</span>';
    return '<span class="kb-g-tel"><span class="kb-msj kb-m1"><b>Bugün ne öğrendik?</b><em lang="en">red · blue · yellow</em></span><span class="kb-msj kb-m2">Evde sorun: “Muz ne renk?”</span><span class="kb-msj kb-m3 kb-ben">“Sarı!” dedi.</span></span>';
  }
  function bakisKur() {
    var k = D.querySelector('.kb'); if (!k) return;
    k.querySelectorAll('[data-kb-gorsel]').forEach(function (g) { g.innerHTML = bakisGorsel(g.getAttribute('data-kb-gorsel')); });
    var sek = [].slice.call(k.querySelectorAll('[data-kbs]')), pan = [].slice.call(k.querySelectorAll('[data-kbp]'));
    var sec = function (n, odak) {
      sek.forEach(function (b, i) { b.setAttribute('aria-selected', i === n); b.tabIndex = i === n ? 0 : -1; });
      pan.forEach(function (p, i) { p.hidden = i !== n; if (i === n) { p.classList.remove('kb-gir'); void p.offsetWidth; p.classList.add('kb-gir'); } });
      if (odak) sek[n].focus();
    };
    sek.forEach(function (b, i) {
      b.addEventListener('click', function () { sec(i); });
      b.addEventListener('keydown', function (e) {
        var n = e.key === 'ArrowRight' ? (i + 1) % 3 : e.key === 'ArrowLeft' ? (i + 2) % 3 : e.key === 'Home' ? 0 : e.key === 'End' ? 2 : -1;
        if (n >= 0) { e.preventDefault(); sec(n, true); }
      });
    });
  }

  /* ---------- yaş dünyaları: üst üste yığılan kartlar, her birinde o yaşın örnek ekranı ---------- */
  function resim(id, hex) { var RS = W.KIDS_RESIM; try { if (RS && (!RS.var || RS.var(id))) return RS.ciz(id); } catch (e) { } return '<span class="kyd-renk" style="background:' + (hex || '#FFD23F') + '"></span>'; }
  function yasEkran(tur) {
    if (tur === 'minik') return '<div class="kyd-e kyd-e-minik"><span class="kyd-ses">' + C.simge('ses') + '</span><div class="kyd-balonlar"><span>' + C.balon(renk('red')) + '</span><span class="kyd-hedef">' + C.balon(renk('yellow')) + '</span><span>' + C.balon(renk('blue')) + '</span></div><span class="kyd-acd">' + C.acadia({ mood: 'mutlu', pose: 'isaret' }) + '</span></div>';
    if (tur === 'kasif') return '<div class="kyd-e kyd-e-kasif"><div class="kyd-resim">' + resim('cat') + '</div><b lang="en">cat</b><p lang="en"><span>It’s a cat!</span></p><span class="kyd-acd">' + C.acadia({ mood: 'kutlama' }) + '</span></div>';
    var k = ['banana', 'apple', 'grapes', 'orange'];
    return '<div class="kyd-e kyd-e-yildiz"><div class="kyd-kartlar">' + k.map(function (w, i) { return '<span class="kyd-k' + (i === 0 ? ' kyd-esli' : '') + '" lang="en">' + w + '</span>'; }).join('') + '</div><div class="kyd-resimler">' + ['apple', 'banana', 'orange', 'grapes'].map(function (w) { return '<span' + (w === 'banana' ? ' class="kyd-esli"' : '') + '>' + resim(w) + '</span>'; }).join('') + '</div><svg class="kyd-cizgi" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M44 14 C60 14 52 38 66 38" /></svg></div>';
  }
  var yasKartlar = [];
  function yasKur() {
    var y = D.querySelector('.kyd'); if (!y) return;
    y.querySelectorAll('[data-ky-ekran]').forEach(function (e) { e.innerHTML = yasEkran(e.getAttribute('data-ky-ekran')); });
    yasKartlar = [].slice.call(y.querySelectorAll('.kyd-kart'));
  }
  function yasCiz() {
    for (var i = 0; i < yasKartlar.length - 1; i++) {
      var a = yasKartlar[i], b = yasKartlar[i + 1], ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      var p = cl((ra.bottom - rb.top) / Math.max(1, ra.height));   /* sonraki kart bunu ne kadar örttü */
      a.style.setProperty('--ort', p.toFixed(3));
    }
  }

  /* ---------- konular: aşağı kaydırdıkça yana akan adalar şeridi ---------- */
  var kk, kkYap, kkSerit, kkCubuk, kkYol = 0;
  function konuKur() {
    kk = D.querySelector('[data-kk]'); if (!kk) return;
    kkYap = kk.querySelector('[data-kk-yap]'); kkSerit = kk.querySelector('[data-kk-serit]'); kkCubuk = kk.querySelector('[data-kk-cubuk]');
    var K = W.KIDS_KONU, top = 0;
    kkSerit.innerHTML = V.KONU.map(function (k, i) {
      var ogeler = K ? K.hepsi(k.id) : []; top += ogeler.length;
      return '<li class="kkn-kart" style="--r:' + k.renk + ';--i:' + i + '"><span class="kkn-ada">' + C.ada(k.renk, k.simge, false) + '</span><b lang="en">' + esc(k.en) + '</b><small>' + esc(k.tr) + '</small>' +
        '<span class="kkn-kel">' + ogeler.slice(0, 4).map(function (o) { return '<i title="' + esc(o.en) + '">' + resim(o.id, o.hex) + '<em lang="en">' + esc(o.en) + '</em></i>'; }).join('') + '</span><span class="kkn-say">' + ogeler.length + ' kelime</span></li>';
    }).join('');
    var ks = kk.querySelector('[data-konu-say]'), ws = kk.querySelector('[data-kelime-say]');
    if (ks) ks.textContent = V.KONU.length; if (ws && top) ws.textContent = top;
    if (SAKIN) { kk.classList.add('kkn-duragan'); return; }
    konuOlc();
  }
  function konuOlc() {
    if (!kk || SAKIN) return;
    kkYol = Math.max(0, kkSerit.offsetWidth - kkSerit.parentNode.clientWidth);
    kk.style.height = 'calc(' + Math.round(kkYol) + 'px + 100vh)';
  }
  function konuCiz() {
    if (!kk || SAKIN) return;
    var r = kk.getBoundingClientRect(), yol = r.height - W.innerHeight, p = yol > 0 ? cl(-r.top / yol) : 0;
    kkSerit.style.transform = 'translate3d(' + (-p * kkYol).toFixed(1) + 'px,0,0)';
    if (kkCubuk) kkCubuk.style.transform = 'scaleX(' + p.toFixed(4) + ')';
  }

  /* ---------- teklif sahnesi: gece adasında Acadia ve el sallayan çocuklar ---------- */
  function teklifKur() {
    var s = D.querySelector('[data-kt2-sahne]'); if (!s) return;
    var y = ''; for (var i = 0; i < 26; i++) y += '<i style="left:' + ((i * 41.3) % 100).toFixed(1) + '%;top:' + ((i * 23.7) % 62).toFixed(1) + '%;--d:' + ((i % 6) * 0.45).toFixed(2) + 's"></i>';
    s.innerHTML = '<span class="kt2-yz">' + y + '</span><span class="kt2-ay"></span>' +
      '<span class="kt2-ada">' + C.ada(konu('colours').renk, konu('colours').simge, false) + '</span>' +
      '<span class="kt2-acd">' + C.acadia({ mood: 'kutlama' }) + '</span>' +
      [['tavsan', 0], ['kedi', 4], ['panda', 6]].map(function (o, i) { return '<span class="kt2-cocuk kt2-c' + i + '">' + C.avatar(o[0], o[1]) + '<i class="kt2-el"></i></span>'; }).join('');
  }

  var bekliyor2 = false;
  function ciz2() { bekliyor2 = false; if (D.getElementById('kl-sayfa').hidden) return; yasCiz(); konuCiz(); }
  function iste2() { if (!bekliyor2) { bekliyor2 = true; W.requestAnimationFrame(ciz2); } }
  function digerKur() {
    yasKur(); konuKur(); teklifKur();
    if (SAKIN) return;
    iste2();
    W.addEventListener('scroll', iste2, { passive: true });
    W.addEventListener('resize', function () { konuOlc(); iste2(); });
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(function () { konuOlc(); iste2(); });
    D.addEventListener('kids:gorunum', function (e) { if (e.detail === 'tanitim') setTimeout(function () { konuOlc(); iste2(); }, 40); });
  }

  function kur() {
    bakisKur();
    if (C && V) digerKur();
    bolum = D.querySelector('[data-film]'); if (!bolum || !C || !V) return;
    yap = bolum.querySelector('[data-kf-yap]'); sahne = bolum.querySelector('[data-kf-sahne]'); cubuk = bolum.querySelector('[data-kf-cubuk]');
    bolumler = [].slice.call(bolum.querySelectorAll('[data-kb]')); noktalar = [].slice.call(bolum.querySelectorAll('[data-kgit]'));
    sahne.innerHTML = sahneHTML();
    noktalar.forEach(function (b, n) { b.addEventListener('click', function () { git(n); }); });
    if (SAKIN) { bolum.classList.add('kf-duragan'); yap.style.setProperty('--t', 1); ['--k1', '--k2', '--k3', '--k4'].forEach(function (k) { yap.style.setProperty(k, 1); }); yap.classList.add('kf-a1', 'kf-a2', 'kf-a3'); perde(1); return; }
    iste();
    W.addEventListener('scroll', iste, { passive: true }); W.addEventListener('resize', iste);
    D.addEventListener('kids:gorunum', function (e) { if (e.detail === 'tanitim') { son = -1; iste(); } });
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', kur); else kur();
  W.KIDS_FILM = { git: git, seg: seg, N: N, durum: function () { return son; }, yasEkran: yasEkran };
})(window);
