/* ==========================================================================
   ACADEX KIDS · tanıtım sayfası (kids/assets/kids-landing.js), 10.11.2026
   Çizimleri yerleştirir, konu listesini kurar, oynanabilir balon demosunu ve
   demo talep formunu (e-posta taslağı açar; tasarım sürümünde sunucu yok) bağlar.
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, C = W.KIDS_CIZ, V = W.KIDS_VERI;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function kur() {
    D.querySelectorAll('[data-acd]').forEach(function (e) { e.innerHTML = C.acadia({ mood: e.getAttribute('data-acd'), pose: e.getAttribute('data-pose') }); });
    D.querySelectorAll('[data-bulut]').forEach(function (e) { e.innerHTML = C.bulut(); });
    D.querySelectorAll('[data-simge]').forEach(function (e) { e.innerHTML = C.simge(e.getAttribute('data-simge')); });
    D.querySelectorAll('[data-av]').forEach(function (e) { e.innerHTML = C.avatar(e.getAttribute('data-av')); });
    D.querySelectorAll('[data-balon]').forEach(function (e) { e.innerHTML = C.balon(e.getAttribute('data-balon')); });
    D.querySelectorAll('[data-ada]').forEach(function (e) { var k = V.KONU.filter(function (x) { return x.id === e.getAttribute('data-ada'); })[0]; e.innerHTML = C.ada(k.renk, k.simge, false); });
    var kl = D.querySelector('[data-konular]');
    if (kl) kl.innerHTML = V.KONU.map(function (k) { return '<li style="--r:' + k.renk + '"><span>' + C.simge(k.simge) + '</span><b lang="en">' + esc(k.en) + '</b><small>' + esc(k.tr) + '</small></li>'; }).join('');

    /* oynanabilir demo: Kâşifler düzeyinde balon oyunu */
    var demo = D.querySelector('[data-demo]'), oyun = null;
    function baslat() {
      if (oyun) oyun.dur();
      oyun = W.KIDS_OYUN.balon(demo, { renkler: V.RENK, bant: V.BANT.kasif, bitti: function (y) {
        W.KIDS_SES.fx('yildiz');
        demo.innerHTML = '<div class="kl-demo-son"><span>' + C.acadia({ mood: 'kutlama' }) + '</span><h3 lang="en">' + ['Good try!', 'Well done!', 'Super!'][y - 1] + '</h3><div class="ka-yildizlar">' + [1, 2, 3].map(function (i) { return '<span class="' + (i <= y ? 'ka-kazan' : '') + '" style="--i:' + i + '">' + C.simge('yildiz') + '</span>'; }).join('') + '</div><button type="button" class="ka-orta" data-demo-basla>Bir daha oyna</button></div>';
        demo.querySelector('[data-demo-basla]').addEventListener('click', baslat);
      } });
    }
    var b = D.querySelector('[data-demo-basla]'); if (b) b.addEventListener('click', baslat);

    /* demo talebi: e-posta taslağı */
    var f = D.querySelector('[data-demo-form]');
    if (f) f.addEventListener('submit', function (e) {
      e.preventDefault(); var not = f.querySelector('[data-form-not]'), v = function (n) { return f.elements[n].value.trim(); };
      if (!v('ad') || !v('okul') || !v('tel')) { not.className = 'kl-form-not kl-hata'; not.textContent = 'Lütfen adınızı, okulunuzun adını ve telefonunuzu yazın.'; (f.querySelector('input:invalid') || f.elements.ad).focus(); return; }
      var govde = 'Merhaba,\n\nAcadex Kids için demo talep ediyorum.\n\nAd soyad: ' + v('ad') + '\nOkul: ' + v('okul') + '\nTelefon: ' + v('tel') + (v('sayi') ? '\nÖğrenci sayısı: ' + v('sayi') : '') + '\n';
      not.className = 'kl-form-not'; not.textContent = 'E-posta uygulamanız açılıyor. Açılmazsa destek@acadex.com.tr adresine yazabilirsiniz.';
      W.location.href = 'mailto:destek@acadex.com.tr?subject=' + encodeURIComponent('Acadex Kids demo talebi: ' + v('okul')) + '&body=' + encodeURIComponent(govde);
    });
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', kur); else kur();
})(window);

/* ==========================================================================
   Kaydırma animasyonları (10.11.2026)
   1) Acadia'nın yolculuğu: geniş ekranda (kenar boşluğu ≥ 96 px) sayfanın iki
      yanındaki boşlukta kesikli bir yol; Acadia kaydırdıkça yol boyunca iner,
      her bölümün başında karşı kıyıdaki adaya uçar (ada o an renklenir).
      Dar ekranda: sağ kenarda ince ilerleme rayı, Acadia rayda kayar.
   2) Dört adım sahnesi: bölüm ekrana sabitlenir; kaydırdıkça tabletteki ekran
      İzle → Dinle → Oyna → Söyle diye değişir.
   Hareket azaltma açıksa ikisi de durağandır (yol gizlenir, sahne sabitlenmez).
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, C = W.KIDS_CIZ, V = W.KIDS_VERI;
  var SAKIN = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ana, yol, yolcu, izDolu, duraklar = [], gecis = [], x0 = 0, yBas = 0, ySon = 0, toplam = 0, genis = false, ray, rayA, sahne, ekranlar, adimlar, cubuk, sonAdim = -1, sonMood = '', bekliyor = false;
  var PENCERE = 90;   /* bir geçişin (adadan adaya uçuş) sürdüğü kaydırma mesafesinin yarısı */
  function ease(u) { return u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }
  function ustY(el) { var y = 0; while (el && el !== ana) { y += el.offsetTop; el = el.offsetParent; } return y; }

  function yolKur() {
    if (!yol || SAKIN) return;
    var w = ana.clientWidth, bosluk = (w - Math.min(1120, w - 32)) / 2; genis = bosluk >= 96;
    yol.hidden = !genis; if (ray) ray.hidden = genis;
    if (!genis) return;
    var sol = Math.round(bosluk / 2), sag = w - sol, bolum = [].slice.call(ana.querySelectorAll('[data-durak]')), x = sag, d = '', L = 0;
    gecis = []; x0 = sag; yBas = ustY(bolum[0]) - 30; d = 'M' + x + ' ' + yBas; var y = yBas;
    bolum.forEach(function (b, i) {
      var pad = parseFloat(getComputedStyle(b).paddingTop) || 48, yi = Math.round(ustY(b) + Math.min(pad, 88) / 2 - 4), xb = x === sag ? sol : sag;
      d += ' V' + yi + ' H' + xb; L += (yi - y);
      gecis.push({ y: yi, xa: x, xb: xb, lBas: L, simge: b.getAttribute('data-durak'), konu: V.KONU[i % V.KONU.length] }); L += Math.abs(xb - x); x = xb; y = yi;
    });
    ySon = ana.scrollHeight - 140; d += ' V' + ySon; L += ySon - y; toplam = L;
    yol.innerHTML = '<svg class="kl-yol-svg" width="' + w + '" height="' + ana.scrollHeight + '" viewBox="0 0 ' + w + ' ' + ana.scrollHeight + '"><path class="kl-iz" d="' + d + '"/><path class="kl-iz-dolu" d="' + d + '" pathLength="' + L + '" stroke-dasharray="' + L + '" stroke-dashoffset="' + L + '"/></svg>' +
      gecis.map(function (g, i) { return '<span class="kl-durak" data-i="' + i + '" style="left:' + g.xb + 'px;top:' + g.y + 'px">' + C.ada(g.konu.renk, g.simge, false) + '</span>'; }).join('') +
      '<span class="kl-yolcu" data-yolcu><span>' + C.acadia({ mood: 'mutlu' }) + '</span></span>';
    izDolu = yol.querySelector('.kl-iz-dolu'); yolcu = yol.querySelector('[data-yolcu]'); duraklar = [].slice.call(yol.querySelectorAll('.kl-durak')); sonMood = '';
  }
  function yolCiz() {
    if (!genis || !yolcu) return;
    var t = W.scrollY + W.innerHeight * 0.46 - (ana.getBoundingClientRect().top + W.scrollY);   /* ana içindeki hedef y */
    t = Math.max(yBas, Math.min(ySon, t));
    var x = x0, y = t, L = t - yBas, ucus = false, yatay = 0;
    for (var i = 0; i < gecis.length; i++) {
      var g = gecis[i];
      if (t < g.y - PENCERE) break;
      if (t <= g.y + PENCERE) { var u = ease((t - (g.y - PENCERE)) / (2 * PENCERE)); x = g.xa + (g.xb - g.xa) * u; y = g.y - Math.sin(Math.PI * u) * 46; L = g.lBas + Math.abs(g.xb - g.xa) * u; ucus = true; yatay = -1; duraklar[i].classList.toggle('kl-vardi', u > .92); break; }
      x = g.xb; yatay += Math.abs(g.xb - g.xa); duraklar[i].classList.add('kl-vardi');
    }
    if (yatay >= 0) L = (t - yBas) + yatay;
    for (var j = i + (ucus ? 1 : 0); j < gecis.length; j++) duraklar[j].classList.remove('kl-vardi');
    yolcu.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
    izDolu.setAttribute('stroke-dashoffset', Math.max(0, toplam - L).toFixed(1));
    var mood = ucus ? 'kutlama' : 'mutlu';
    if (mood !== sonMood) { sonMood = mood; yolcu.firstChild.innerHTML = C.acadia({ mood: mood }); yolcu.classList.toggle('kl-ucuyor', ucus); }
  }
  function rayCiz() {
    if (!ray || ray.hidden) return;
    var max = D.documentElement.scrollHeight - W.innerHeight, p = max > 0 ? Math.min(1, Math.max(0, W.scrollY / max)) : 0;
    ray.style.setProperty('--p', p.toFixed(4));
  }

  /* ---------- dört adım sahnesi ---------- */
  function ekranHTML() {
    var r = V.RENK;
    return [
      '<div class="kl-ekran kl-e-izle"><span class="kl-e-acd">' + C.acadia({ mood: 'mutlu', pose: 'isaret' }) + '</span><span class="kl-e-leke">' + C.leke(r[0].hex) + '</span><b lang="en" style="--r:' + r[0].hex + '">red</b></div>',
      '<div class="kl-ekran kl-e-dinle"><span>' + C.leke(r[1].hex) + '</span><span class="kl-e-secili">' + C.leke(r[2].hex) + '<i>' + C.simge('ses') + '</i></span><span>' + C.leke(r[3].hex) + '</span><b lang="en" style="--r:' + r[2].hex + '">blue</b></div>',
      '<div class="kl-ekran kl-e-oyna"><p lang="en">Pop the <b style="--r:' + r[1].hex + '">yellow</b> balloon!</p><div><span>' + C.balon(r[0].hex) + '</span><span class="kl-e-hedef">' + C.balon(r[1].hex) + '</span><span>' + C.balon(r[3].hex) + '</span></div></div>',
      '<div class="kl-ekran kl-e-soyle"><span class="kl-e-leke">' + C.leke(r[3].hex) + '</span><span class="kl-e-mik">' + C.simge('mikrofon') + '</span><b lang="en" style="--r:' + r[3].hex + '">“green!”</b><span class="kl-e-acd">' + C.acadia({ mood: 'kutlama' }) + '</span></div>'
    ].join('');
  }
  function sahneCiz() {
    if (!sahne) return;
    var r = sahne.getBoundingClientRect(), yol2 = r.height - W.innerHeight, p = SAKIN || yol2 <= 0 ? 0 : Math.min(1, Math.max(0, -r.top / yol2)), i = Math.min(3, Math.floor(p * 4));
    if (cubuk) cubuk.style.width = (p * 100).toFixed(1) + '%';
    if (i === sonAdim) return; sonAdim = i;
    adimlar.forEach(function (li, n) { li.classList.toggle('kl-aktif', n === i); li.classList.toggle('kl-gecti', n < i); });
    [].forEach.call(ekranlar.children, function (e, n) { e.classList.toggle('kl-aktif', n === i); });
  }

  function ciz() { bekliyor = false; if (D.getElementById('kl-sayfa').hidden) return; yolCiz(); rayCiz(); sahneCiz(); }
  function iste() { if (!bekliyor) { bekliyor = true; W.requestAnimationFrame(ciz); } }
  function yeniden() { yolKur(); sonAdim = -1; iste(); }

  function kur() {
    ana = D.getElementById('icerik'); if (!ana) return;
    yol = D.querySelector('[data-yolculuk]'); ray = D.querySelector('[data-ray]');
    if (ray) { ray.querySelector('span').innerHTML = C.acadia({ mood: 'mutlu' }); if (SAKIN) ray.remove(), ray = null; }
    sahne = D.querySelector('[data-sahne]');
    if (sahne) {
      ekranlar = sahne.querySelector('[data-ekranlar]'); ekranlar.innerHTML = ekranHTML(); cubuk = sahne.querySelector('[data-sahne-cubuk]'); adimlar = [].slice.call(sahne.querySelectorAll('[data-adim]'));
      if (SAKIN) sahne.classList.add('kl-sahne-duragan');
      adimlar.forEach(function (li, n) { li.querySelector('button').addEventListener('click', function () {
        if (SAKIN) { sonAdim = n; adimlar.forEach(function (x, k) { x.classList.toggle('kl-aktif', k === n); }); [].forEach.call(ekranlar.children, function (e, k) { e.classList.toggle('kl-aktif', k === n); }); return; }
        var r = sahne.getBoundingClientRect(), yol2 = r.height - W.innerHeight; W.scrollTo({ top: W.scrollY + r.top + yol2 * (n + .5) / 4, behavior: 'smooth' });
      }); });
    }
    yeniden();
    W.addEventListener('scroll', iste, { passive: true }); W.addEventListener('resize', yeniden);
    if (W.ResizeObserver) new W.ResizeObserver(yeniden).observe(ana);
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(yeniden);
    D.addEventListener('kids:gorunum', function (e) { if (e.detail === 'tanitim') setTimeout(yeniden, 30); });
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', kur); else kur();
})(window);
