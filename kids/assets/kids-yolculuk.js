/* ==========================================================================
   ACADEX KIDS · tanıtım sayfası UZAY YOLCULUĞU (kids/assets/kids-yolculuk.js + .css), 20.11.2026
   Kaydırmak = yolculuk. Sayfa derin uzayda geçer; her bölüm bir gezegen.
     - Evren: üç katman yıldız (paralaks, kendi tuvali), bölümün renginde yumuşakça değişen nebula
     - Astronot rehber: sağ altta süzülür; kaydırınca jetpack yanar, yeni bölümde el sallar,
       konuşma balonunda "Hadi buraya!" der; ilk sahnede gezegene dalar
     - Sahneler (masaüstünde ekrana oturur, kaydırdıkça oynar):
         1 Okulla aynı gün: astronot gezegene dalar, gezegen ekranı kaplar, bölüm açılır
         2 Kolay giriş: gezegen yavaşça bir giriş kartına dönüşür (yüz, iki gizli resim, QR)
         3 Söyle: dev mikrofon, balonlar esneyerek yükselir, kaydırdıkça / dokununca patlar
         4 Masal: kitap açılır, otobüs yolda gelir ("Otobüs → bus"), sonra tren ve kuş
     - El çizimi sloganlar (SVG çizgi animasyonu), dokunulan sürprizler (yıldız, ateş topu,
       UFO → yıldız patlaması), imleç yıldız tozu, şişme ve jöle düğmeler (CSS)
   Altyapı: GSAP + ScrollTrigger yerel dosyadan (kids-gsap.js), yalnız bu sayfa açılınca yüklenir.
   Telefonda sahneler oturmaz, hafif açılış animasyonları oynar.
   27.11.2026 telefon/tablet akıcılığı: sahneleri ekrana oturtma (pin) + kaydırmayla oynatma (scrub) +
   yakalama (snap) yalnız fare/izleme dörtgeni olan geniş ekranda. Dokunmatik tablette aynı dört sahne
   bölüm görününce kendiliğinden bir kez oynar; parmağın kaydırması asla geri çekilmez/oturtulmaz.
   Adres çubuğu kayarken (yalnız yükseklik değişir) ScrollTrigger yenilenmez, yıldızlar yeniden
   dağılmaz; dokunmatik cihazda kaydırma yokken yıldız döngüsü seyrekleşir (pil). Hareketi azalt açıksa GSAP hiç
   yüklenmez; her sahne bitmiş hâliyle durur (CSS'in varsayılanı bitmiş hâldir).
   Çizimler Acadex'in kendi çizimleri (kids-ciz, kids-resim, kids-uzay); dış kaynak yok.
   W.KIDS_YOLCULUK = { kur, durum }
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, H = D.documentElement;
  var SAKIN = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var DAR = function () { return W.innerWidth <= 760; };
  /* sınıf hemen: kids-scroll.js gökyüzü / hero / yumuşak tekerleği bu sayfada açmaz */
  H.classList.add('kyo');
  if (SAKIN) H.classList.add('kyo-statik');

  var SOZ = { ust: 'Merhaba! Hadi uçalım! 🚀', nasil: 'Bir günü birlikte izleyelim!', bakis: 'Herkes kazanıyor!', baslangic: 'Üç adımda başla!', dene: 'Hadi, sen de oyna!', yas: 'Her yaşa bir dünya!', 'icerik-konular': '22 gezegen seni bekliyor!', fiyat: 'Kreşine gelelim mi?', sss: 'Merak ettiğin bir şey var mı?' };
  var kok, rehber, balon, evrenT, efektT, nebula, gs = null, ST = null, durum = { gsap: false, sahne: '' };

  /* ---------------- çizimleri yerleştir ---------------- */
  function cizimler() {
    var U = W.KIDS_UZAY, V = W.KIDS_VERI, R = W.KIDS_RESIM;
    D.querySelectorAll('[data-ky-gz]').forEach(function (e, i) {
      var k = V && V.konuBul(e.getAttribute('data-ky-gz')); if (!k || !U) return;
      e.innerHTML = U.gezegen(k.renk, k.simge, false, 3, i + 1);
    });
    D.querySelectorAll('[data-ky-r]').forEach(function (e) { if (R) e.innerHTML = '<span class="kn-resim">' + R.ciz(e.getAttribute('data-ky-r')) + '</span>'; });
    var q = D.querySelector('[data-ky-qr]'); if (q && W.KIDS_QR) try { q.innerHTML = W.KIDS_QR.svg('https://acadex.com.tr/kids', { renk: '#23304D' }); } catch (e) { }
  }

  /* ---------------- evren: yıldız katmanları ---------------- */
  var Y = [], dpr = 1, ew = 0, eh = 0, ectx = null, sonY = -1;
  function evrenKur() {
    var k = D.createElement('div'); k.className = 'kyo-evren'; k.setAttribute('aria-hidden', 'true');
    k.innerHTML = '<div class="kyo-nebula"></div><canvas class="kyo-yildizlar"></canvas>';
    kok.insertBefore(k, kok.firstChild);
    nebula = k.firstChild; evrenT = k.lastChild; ectx = evrenT.getContext('2d');
    evrenBoyut(); W.addEventListener('resize', evrenBoyut, { passive: true });
  }
  function evrenBoyut() {
    /* adres çubuğu: yalnız yükseklik değiştiyse yıldızlar yerinde kalır, tuval boyu güncellenir */
    if (Y.length && W.innerWidth === ew && Math.abs(W.innerHeight - eh) < 220) {
      eh = W.innerHeight; evrenT.height = Math.round(eh * dpr); ectx.setTransform(dpr, 0, 0, dpr, 0, 0); yildizCiz(performance.now()); return;
    }
    dpr = Math.min(2, W.devicePixelRatio || 1); ew = W.innerWidth; eh = W.innerHeight;
    evrenT.width = Math.round(ew * dpr); evrenT.height = Math.round(eh * dpr); ectx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = Math.round(Math.min(220, Math.max(90, ew * eh / 6500))); Y = [];
    for (var i = 0; i < n; i++) { var k = i % 3; Y.push({ x: Math.random() * ew, y: Math.random() * eh * 3, r: [0.7, 1.1, 1.8][k] * (0.8 + Math.random() * 0.4), h: [0.05, 0.16, 0.34][k], f: Math.random() * 6.28, c: ['#FFFFFF', '#FFF3B0', '#BFE3FF', '#FFC9DE'][i % 4] }); }
    sonY = -1; yildizCiz(performance.now());
  }
  function yildizCiz(t) {
    var sy = W.scrollY || 0; ectx.clearRect(0, 0, ew, eh);
    for (var i = 0; i < Y.length; i++) {
      var s = Y[i], y = ((s.y - sy * s.h) % (eh * 3) + eh * 3) % (eh * 3); if (y > eh + 4) continue;
      var p = SAKIN ? 0.85 : 0.55 + 0.45 * Math.sin(t / 1000 * (1 + s.h * 3) + s.f);
      ectx.globalAlpha = p; ectx.fillStyle = s.c; ectx.beginPath(); ectx.arc(s.x, y, s.r, 0, 6.283); ectx.fill();
      if (s.r > 1.8 && p > 0.9) { ectx.globalAlpha = (p - 0.9) * 6; ectx.fillRect(s.x - s.r * 3, y - 0.5, s.r * 6, 1); ectx.fillRect(s.x - 0.5, y - s.r * 3, 1, s.r * 6); }
    }
    ectx.globalAlpha = 1;
  }

  /* ---------------- efekt tuvali: imleç yıldız tozu ve patlamalar ---------------- */
  var P = [], fctx = null, fraf = 0;
  function efektKur() {
    efektT = D.createElement('canvas'); efektT.className = 'kyo-efekt'; efektT.setAttribute('aria-hidden', 'true'); kok.appendChild(efektT);
    fctx = efektT.getContext('2d'); efektBoyut(); W.addEventListener('resize', efektBoyut, { passive: true });
    if (SAKIN) return;
    var son = 0;
    W.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' || kok.hidden) return;
      var t = performance.now(); if (t - son < 24) return; son = t;
      parca(e.clientX, e.clientY, 1, 0.25, ['#FFF3B0', '#FFFFFF', '#BFE3FF', '#FFC9DE']);
    }, { passive: true });
  }
  function efektBoyut() { var d = Math.min(2, W.devicePixelRatio || 1); efektT.width = Math.round(W.innerWidth * d); efektT.height = Math.round(W.innerHeight * d); fctx.setTransform(d, 0, 0, d, 0, 0); }
  function parca(x, y, n, guc, renk) {
    for (var i = 0; i < n; i++) { var a = Math.random() * 6.283, v = (guc || 1) * (60 + Math.random() * 220); P.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (guc < 0.5 ? 20 : 0), t: 0, s: 0.5 + Math.random() * 0.5, r: (guc < 0.5 ? 1.5 : 2.5) + Math.random() * 3, c: renk[i % renk.length], y5: i % 3 === 0 }); }
    if (!fraf) { fson = performance.now(); fraf = W.requestAnimationFrame(efektDon); }
  }
  var fson = 0;
  function yildiz5(x, y, r) { fctx.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; fctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } fctx.closePath(); fctx.fill(); }
  function efektDon(t) {
    var dt = Math.min(0.05, (t - fson) / 1000); fson = t; fraf = 0;
    fctx.clearRect(0, 0, W.innerWidth, W.innerHeight);
    for (var i = P.length - 1; i >= 0; i--) {
      var p = P[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 2.4; p.vy = p.vy * (1 - dt * 2.4) + 70 * dt;
      var a = Math.max(0, 1 - p.t / p.s); fctx.globalAlpha = a; fctx.fillStyle = p.c;
      if (p.y5) yildiz5(p.x, p.y, p.r * 1.7); else { fctx.beginPath(); fctx.arc(p.x, p.y, p.r * (0.4 + a * 0.6), 0, 6.283); fctx.fill(); }
      if (p.t > p.s) P.splice(i, 1);
    }
    fctx.globalAlpha = 1;
    if (P.length) fraf = W.requestAnimationFrame(efektDon);
  }
  function patlat(el, renk) { var r = el.getBoundingClientRect(); parca(r.left + r.width / 2, r.top + r.height / 2, 26, 1, renk || ['#FFD23F', '#FF9F3A', '#FFF3B0', '#FF6B5B', '#FFFFFF']); }

  /* ---------------- dokunulan sürprizler: yıldız, ateş topu, UFO ---------------- */
  var SURPRIZ = [
    ['kyo-s-yildiz', '<svg viewBox="0 0 40 40"><path d="M20 3l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z" fill="#FFD23F" stroke="#23304D" stroke-width="2.5" stroke-linejoin="round"/></svg>'],
    ['kyo-s-ates', '<i></i>'],
    ['kyo-s-ufo', '<svg viewBox="0 0 70 40"><ellipse cx="35" cy="16" rx="12" ry="11" fill="#9FE8FF" stroke="#23304D" stroke-width="2.5"/><ellipse cx="35" cy="24" rx="32" ry="9" fill="#C3C9DD" stroke="#23304D" stroke-width="2.5"/><circle cx="18" cy="25" r="2.6" fill="#FF6B5B"/><circle cx="35" cy="27" r="2.6" fill="#FFD23F"/><circle cx="52" cy="25" r="2.6" fill="#4CC38A"/></svg>']
  ];
  function surprizKur() {
    var bolum = [].slice.call(kok.querySelectorAll('#icerik > section'));
    bolum.forEach(function (b, i) {
      if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
      var n = DAR() ? 1 : 2;
      for (var j = 0; j < n; j++) {
        var s = SURPRIZ[(i + j) % SURPRIZ.length], e = D.createElement('button');
        e.type = 'button'; e.className = 'kyo-surpriz ' + s[0]; e.tabIndex = -1; e.setAttribute('aria-hidden', 'true'); e.innerHTML = s[1];
        /* yazıların üstüne binmesin: yalnız sağ/sol kenar şeritleri */
        var sag = (i + j) % 2 === 1;
        e.style.left = sag ? 'auto' : (1 + (i * 7) % 4) + '%'; e.style.right = sag ? (1 + (i * 5) % 4) + '%' : 'auto';
        e.style.top = (12 + ((i * 23 + j * 41) % 66)) + '%';
        b.appendChild(e);
        var vur = function (ev) {
          var el = ev.currentTarget; if (el.classList.contains('kyo-vuruldu')) return;
          el.classList.add('kyo-vuruldu'); patlat(el, el.classList.contains('kyo-s-ufo') ? ['#BFF7E8', '#FFD23F', '#FFFFFF'] : null);
          setTimeout(function () { el.classList.remove('kyo-vuruldu'); }, 3500);
        };
        e.addEventListener('pointerenter', function (ev) { if (ev.pointerType === 'mouse') vur(ev); });
        e.addEventListener('pointerdown', vur);
      }
    });
  }

  /* ---------------- astronot rehber ---------------- */
  var bolumler = [], simdiki = null, sonKay = 0, ucusZ = 0, dalisAktif = false;
  function rehberKur() {
    rehber = D.createElement('div'); rehber.className = 'kyo-rehber'; rehber.setAttribute('aria-hidden', 'true');
    rehber.innerHTML = '<div class="kyo-r-ic">' + (W.KIDS_UZAY ? W.KIDS_UZAY.astronotHtml('kedi') : '') + '</div><p class="kyo-r-balon"></p>';
    kok.appendChild(rehber); balon = rehber.querySelector('.kyo-r-balon');
    bolumler = [].slice.call(kok.querySelectorAll('#icerik > section'));
    soyle(SOZ.ust);
  }
  /* konuşma balonu birkaç saniye görünür, sonra içeriğin önünde durmasın diye söner */
  var susZ = 0;
  function soyle(s) {
    if (!balon || balon.textContent === s && !balon.classList.contains('kyo-sus')) return;
    balon.classList.remove('kyo-gel', 'kyo-sus'); void balon.offsetWidth; balon.textContent = s; balon.classList.add('kyo-gel');
    clearTimeout(susZ); susZ = setTimeout(function () { balon.classList.add('kyo-sus'); }, 3800);
  }
  function selam() { if (SAKIN) return; rehber.classList.remove('kyo-selam'); void rehber.offsetWidth; rehber.classList.add('kyo-selam'); }
  function bolumBak() {
    var orta = W.innerHeight * 0.45, bul = null, ilerleme = 0;
    for (var i = 0; i < bolumler.length; i++) { var r = bolumler[i].getBoundingClientRect(); if (r.top <= orta && r.bottom > orta) { bul = bolumler[i]; ilerleme = (orta - r.top) / Math.max(1, r.height); break; } }
    if (!bul) return;
    if (bul !== simdiki) {
      simdiki = bul; durum.sahne = bul.id || '';
      var renk = bul.getAttribute('data-ky-renk') || RENK[bul.id] || '#2A1E66';
      if (nebula) nebula.style.setProperty('--kyo-a', renk);
      soyle(bul.getAttribute('data-ky-soz') || SOZ[bul.id] || 'Hadi buraya!'); selam();
    } else if (ilerleme > 0.86 && !dalisAktif) { soyle('Hadi buraya! 👇'); rehber.classList.add('kyo-isaret'); }
    else rehber.classList.remove('kyo-isaret');
  }
  var RENK = { nasil: '#3B2A8A', bakis: '#24407A', baslangic: '#2B5A7A', dene: '#1F5F5A', yas: '#6A3A7A', 'icerik-konular': '#7A4A2A', fiyat: '#4A2A86', sss: '#1A1B57' };
  /* kaydırma hızı: hızlıysa jetpack yanar, astronot öne eğilir */
  var kare = 0, bosKare = 0, sonOynama = 0;
  var DOKUN = !!(W.matchMedia && W.matchMedia('(pointer: coarse)').matches);
  function dongu(t) {
    kare = 0; if (kok.hidden) return;
    var y = W.scrollY, v = y - (sonY < 0 ? y : sonY); sonY = y;
    if (v) sonOynama = t;
    /* dokunmatik cihazda kaydırma yoksa yıldızlar 3 karede bir çizilir (pil, ısınma) */
    if (DOKUN && !v && t - sonOynama > 1200 && (++bosKare % 3)) { kare = W.requestAnimationFrame(dongu); return; }
    if (Math.abs(v) > 2 && !SAKIN) { rehber.classList.add('kz-ucuyor'); rehber.style.setProperty('--kyo-egim', Math.max(-14, Math.min(14, v * 0.6)).toFixed(1) + 'deg'); clearTimeout(ucusZ); ucusZ = setTimeout(function () { rehber.classList.remove('kz-ucuyor'); rehber.style.setProperty('--kyo-egim', '0deg'); }, 260); }
    yildizCiz(t); bolumBak();
    if (!SAKIN) kare = W.requestAnimationFrame(dongu);
  }
  function dur() { if (kare) W.cancelAnimationFrame(kare); kare = 0; }
  function basla() { if (!kare && !kok.hidden) kare = W.requestAnimationFrame(dongu); }

  /* ---------------- balonlar (dokununca patlar; sahnede kaydırınca da) ---------------- */
  function balonPatlat(b, sessiz) {
    if (b.classList.contains('kyo-patladi')) return;
    b.classList.add('kyo-patladi'); b.setAttribute('data-ky-yazi', b.getAttribute('data-ky-kelime'));
    if (!sessiz) patlat(b, [getComputedStyle(b).getPropertyValue('--r').trim() || '#FFD23F', '#FFFFFF', '#FFD23F']);
    var af = D.querySelector('.kyo-aferin'); if (af) { af.classList.remove('kyo-gel'); void af.offsetWidth; af.classList.add('kyo-gel'); }
  }
  function balonOnar(b) { b.classList.remove('kyo-patladi'); }
  function balonKur() {
    D.querySelectorAll('.kyo-balon').forEach(function (b) {
      b.addEventListener('click', function () { if (b.classList.contains('kyo-patladi')) { balonOnar(b); return; } balonPatlat(b); });
    });
  }

  /* ---------------- el çizimi: çizgi uzunlukları ---------------- */
  function cizgiHazirla() {
    D.querySelectorAll('.kyo-cizgi').forEach(function (p) { try { var L = Math.ceil(p.getTotalLength()); p.style.setProperty('--L', L); p.style.strokeDasharray = L; } catch (e) { } });
  }

  /* ---------------- GSAP sahneleri ---------------- */
  function gsapYukle() {
    return new Promise(function (ok, no) {
      if (W.gsap && W.ScrollTrigger) return ok();
      var s = D.createElement('script'); s.src = '/kids/assets/kids-gsap.js'; s.async = true;
      s.onload = function () { W.gsap && W.ScrollTrigger ? ok() : no(new Error('gsap yok')); }; s.onerror = no; D.head.appendChild(s);
      setTimeout(function () { no(new Error('zaman aşımı')); }, 8000);
    });
  }
  function sahneler() {
    gs = W.gsap; ST = W.ScrollTrigger; gs.registerPlugin(ST); durum.gsap = true;
    /* telefonda adres çubuğu kayınca yalnız yükseklik değişir: yenileme yok (zıplama/titreme olmasın) */
    ST.config({ ignoreMobileResize: true });
    H.classList.add('kyo-gsap');
    var mm = gs.matchMedia();
    /* ortak: el çizimi sloganlar, bölüm açılışları (her ekranda) */
    mm.add('(prefers-reduced-motion: no-preference)', function () {
      D.querySelectorAll('.kyo-el').forEach(function (svg) {
        var t = svg.querySelector('text'), c = svg.querySelectorAll('.kyo-cizgi');
        var tl = gs.timeline({ scrollTrigger: { trigger: svg, start: 'top 85%', toggleActions: 'play none none reverse' } });
        if (t) tl.fromTo(t, { strokeDashoffset: 1400, fillOpacity: 0 }, { strokeDashoffset: 0, duration: 1.6, ease: 'power1.inOut' }).to(t, { fillOpacity: 1, duration: 0.4 }, '-=0.3');
        c.forEach(function (p) { tl.fromTo(p, { strokeDashoffset: function () { return +p.style.getPropertyValue('--L') || 300; } }, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.out' }, '-=0.2'); });
      });
      /* eski bölümler: başlık ve kartlar aşağıdan esneyerek gelir */
      /* 27.11.2026: bu öğeler kids-scroll'un eski girişinde de (.kl-gir: opacity 0) işaretliydi. gs.from bitiş değeri
         olarak o anki gizli hâli alıyor, adımlar telefon/tablette (ve GSAP geç yüklenince masaüstünde) görünmez
         kalıyordu. Artık eski giriş bu öğeleri bırakır, bitiş değerleri açıkça verilir. */
      gs.utils.toArray('.kl-adimlar>li, .kl-guvenler>li, .kyo-adim>li').forEach(function (el, i) {
        el.classList.remove('kl-gir', 'kl-geldi');
        gs.fromTo(el, { y: 50, scale: 0.9, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(2)', delay: (i % 4) * 0.08, scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none none' } });
      });
    });

    /* geniş ekran sahneleri. oto=false: fare/izleme dörtgeni — sahne ekrana oturur, kaydırdıkça oynar,
       etikete yakalanır. oto=true: dokunmatik tablet — oturma ve yakalama yok, bölüm görününce sahne
       kendiliğinden bir kez oynar (iOS/Android'de parmakla kaydırma hiç geri çekilmez). */
    function sahneKur(oto) {
      var ortak = function (sec, uzun) {
        if (oto) return { trigger: sec, start: 'top 72%', toggleActions: 'play none none none' };
        return { trigger: sec, start: 'top top', end: '+=' + uzun, pin: sec.querySelector('.kyo-pin'), scrub: 1, anticipatePin: 1, snap: W.KY_OTURTMA === false ? false : { snapTo: 'labelsDirectional', duration: { min: 0.25, max: 0.8 }, delay: 0.12, ease: 'power1.inOut' } };
      };
      var reh = oto ? {} : rehber;   /* tablette rehber köşesinde kalır */

      /* 1 · dalış */
      var s1 = D.querySelector('#kyo-okul');
      if (s1) {
        var gz = s1.querySelector('.kyo-dalis'), ic = s1.querySelector('.kyo-icerik');
        var tl1 = gs.timeline({ scrollTrigger: oto ? ortak(s1) : Object.assign(ortak(s1, '160%'), { onEnter: function () { dalisAktif = true; }, onLeave: function () { dalisAktif = false; }, onEnterBack: function () { dalisAktif = true; }, onLeaveBack: function () { dalisAktif = false; } }) });
        tl1.addLabel('bas')
          .fromTo(gz, { scale: 0.35, rotate: -20, opacity: 1 }, { scale: 1, rotate: 0, duration: 1, ease: 'power2.out' })
          .fromTo(reh, { x: 0, y: 0, scale: 1 }, { x: function () { var r = rehber.getBoundingClientRect(); return W.innerWidth / 2 - (r.left + r.width / 2); }, y: function () { var r = rehber.getBoundingClientRect(); return W.innerHeight / 2 - (r.top + r.height / 2); }, scale: 0.3, duration: 1, ease: 'power2.in' }, '<0.2')
          .addLabel('dalis')
          .to(gz, { scale: 12, duration: 1.2, ease: 'power3.in' })
          .to(gz, { opacity: 0, duration: 0.4 }, '-=0.35')
          .set(reh, { x: 0, y: 0, scale: 1 })
          .fromTo(ic.children, { y: 70, opacity: 0, scale: 0.92 }, { y: 0, opacity: 1, scale: 1, stagger: 0.12, duration: 0.8, ease: 'back.out(1.8)' }, '-=0.1')
          .fromTo(s1.querySelectorAll('.kyo-ok .kyo-cizgi'), { strokeDashoffset: function (i, p) { return +p.style.getPropertyValue('--L') || 200; } }, { strokeDashoffset: 0, duration: 0.6 }, '-=0.4')
          .addLabel('son');
      }

      /* 2 · gezegen → giriş kartı */
      var s2 = D.querySelector('#kyo-giris');
      if (s2) {
        var kart = s2.querySelector('.kyo-mkart'), kgz = s2.querySelector('.kyo-mkart-gz'), parcalar = s2.querySelectorAll('.kyo-mkart-ic > *'), metin = s2.querySelectorAll('.kyo-metin > *');
        var tl2 = gs.timeline({ scrollTrigger: ortak(s2, '150%') });
        tl2.addLabel('bas')
          .from(metin, { x: -60, opacity: 0, stagger: 0.1, duration: 0.6, ease: 'power2.out' })
          .fromTo(kart, { width: 230, height: 230, borderRadius: 115, backgroundColor: 'rgba(255,255,255,0)', borderColor: 'rgba(255,255,255,0)', boxShadow: '0 0 0 rgba(11,16,51,0)' }, { width: 230, height: 230, duration: 0.3 }, '<')
          .fromTo(kgz, { x: 0, y: 0, scale: 1.6, rotate: -30, opacity: 1, xPercent: 0, yPercent: 0 }, { rotate: 20, duration: 0.8 }, '<')
          .addLabel('donus')
          .to(kart, { width: 300, height: 410, borderRadius: 34, backgroundColor: '#FFFFFF', borderColor: '#23304D', boxShadow: '0 10px 0 #23304D', duration: 1, ease: 'power2.inOut' })
          .to(kgz, { scale: 0.32, xPercent: 115, yPercent: -125, rotate: 0, duration: 1, ease: 'power2.inOut' }, '<')
          .fromTo(parcalar, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, stagger: 0.15, duration: 0.6, ease: 'back.out(2.2)' }, '-=0.2')
          .addLabel('son');
      }

      /* 3 · söyle: mikrofon, balonlar yükselir, sırayla patlar */
      var s3 = D.querySelector('#kyo-soyle');
      if (s3) {
        var mik = s3.querySelector('.kyo-mik'), bl = gs.utils.toArray(s3.querySelectorAll('.kyo-balon')), baslik = s3.querySelectorAll('.kyo-icerik > h2, .kyo-icerik > .kyo-alt');
        var tl3 = gs.timeline({ scrollTrigger: oto ? ortak(s3) : Object.assign(ortak(s3, '180%'), { onUpdate: function (self) {
          var p = self.progress; bl.forEach(function (b, i) { var esik = 0.55 + i * 0.08; if (p > esik && !b.classList.contains('kyo-patladi') && self.direction > 0) balonPatlat(b); if (p < esik - 0.02 && self.direction < 0 && b.classList.contains('kyo-patladi')) balonOnar(b); });
        } }) });
        tl3.addLabel('bas')
          .from(baslik, { y: 40, opacity: 0, stagger: 0.1, duration: 0.5 })
          .fromTo(mik, { scale: 0, rotate: -25 }, { scale: 1, rotate: 0, duration: 0.8, ease: 'elastic.out(1, 0.5)' }, '<')
          .fromTo(bl, { y: 420, scaleY: 1.25, scaleX: 0.8, opacity: 0 }, { y: 0, scaleY: 1, scaleX: 1, opacity: 1, stagger: 0.12, duration: 1, ease: 'back.out(2.4)' })
          .addLabel('yukseldi')
          .to({}, { duration: 2.2 })
          .addLabel('son');
        /* tablet: balonlar yükselince sırayla kendiliğinden patlar */
        if (oto) bl.forEach(function (b, i) { tl3.call(function () { balonPatlat(b); }, null, 'yukseldi+=' + (0.3 + i * 0.35).toFixed(2)); });
      }

      /* 4 · masal: kitap açılır, otobüs gelir, kart, tren, kuş */
      var s4 = D.querySelector('#kyo-masal');
      if (s4) {
        var sol = s4.querySelector('.kyo-sayfa-sol'), sag = s4.querySelector('.kyo-sayfa-sag'), kk = s4.querySelector('.kyo-kelime-kart'), bus = s4.querySelector('.kyo-a-bus'), train = s4.querySelector('.kyo-a-train'), bird = s4.querySelector('.kyo-a-bird'), yol = s4.querySelector('.kyo-yol');
        var tl4 = gs.timeline({ scrollTrigger: ortak(s4, '200%') });
        tl4.addLabel('bas')
          .fromTo(sol, { rotateY: 80, opacity: 0 }, { rotateY: 0, opacity: 1, duration: 0.7, ease: 'power2.out' })
          .fromTo(sag, { rotateY: -80, opacity: 0 }, { rotateY: 0, opacity: 1, duration: 0.7, ease: 'power2.out' }, '<0.1')
          .fromTo(yol, { scaleX: 0 }, { scaleX: 1, duration: 0.5 }, '<')
          .fromTo(bus, { x: function () { return -W.innerWidth * 0.7; }, opacity: 1 }, { x: 0, duration: 1.2, ease: 'power3.out' })
          .fromTo(kk, { scale: 0, rotate: -8 }, { scale: 1, rotate: 0, duration: 0.6, ease: 'back.out(2.5)' })
          .addLabel('otobus')
          .to(bus, { x: -230, duration: 0.8, ease: 'power2.inOut' }, '+=0.4')
          .fromTo(train, { x: function () { return W.innerWidth * 0.7; }, opacity: 1 }, { x: 230, duration: 1.1, ease: 'power3.out' }, '<0.2')
          .addLabel('tren')
          .fromTo(bird, { x: function () { return -W.innerWidth * 0.6; }, y: 40, opacity: 0 }, { x: 0, y: -10, opacity: 1, duration: 1.1, ease: 'sine.out' }, '+=0.2')
          .addLabel('son');
      }
      return function () { gs.set(rehber, { clearProps: 'transform' }); };
    }
    mm.add('(min-width: 761px) and (pointer: fine) and (prefers-reduced-motion: no-preference)', function () { return sahneKur(false); });
    mm.add('(min-width: 761px) and (pointer: coarse) and (prefers-reduced-motion: no-preference), (min-width: 761px) and (pointer: none) and (prefers-reduced-motion: no-preference)', function () { return sahneKur(true); });

    /* telefon: oturma yok, sahneler açılınca bir kez oynar */
    mm.add('(max-width: 760px) and (prefers-reduced-motion: no-preference)', function () {
      gs.utils.toArray('.kyo-sahne .kyo-icerik > *').forEach(function (el) { gs.from(el, { y: 40, opacity: 0, duration: 0.6, ease: 'back.out(1.6)', scrollTrigger: { trigger: el, start: 'top 88%' } }); });
      var bl = gs.utils.toArray('.kyo-balon'); if (bl.length) gs.from(bl, { y: 200, opacity: 0, stagger: 0.1, duration: 0.9, ease: 'back.out(2.2)', scrollTrigger: { trigger: '.kyo-balonlar', start: 'top 85%' } });
      var bus = D.querySelector('.kyo-a-bus'); if (bus) gs.from(bus, { xPercent: -600, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: '.kyo-yol-alan', start: 'top 85%' } });
    });
    W.addEventListener('load', function () { ST.refresh(); });
    D.addEventListener('kids:gorunum', function (e) { if (e.detail === 'tanitim') setTimeout(function () { ST.refresh(); }, 50); });
  }

  /* ---------------- çerçeve ---------------- */
  function kur() {
    kok = D.getElementById('kl-sayfa'); if (!kok || kok.dataset.ky) return; kok.dataset.ky = '1';
    cizimler(); evrenKur(); efektKur(); rehberKur(); surprizKur(); balonKur(); cizgiHazirla();
    W.addEventListener('scroll', function () { if (SAKIN) { yildizCiz(0); bolumBak(); } else basla(); }, { passive: true });
    D.addEventListener('visibilitychange', function () { if (D.hidden) dur(); else basla(); });
    if (W.MutationObserver) new MutationObserver(function () { if (kok.hidden) dur(); else basla(); }).observe(kok, { attributes: true, attributeFilter: ['hidden'] });
    bolumBak(); basla();
    if (SAKIN) return;
    gsapYukle().then(sahneler, function (e) { H.classList.add('kyo-statik'); if (W.console) console.warn('Uzay yolculuğu sade modda:', e && e.message); });
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', kur); else kur();
  W.KIDS_YOLCULUK = { kur: kur, durum: function () { return durum; } };
})(window);
