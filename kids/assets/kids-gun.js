/* ==========================================================================
   ACADEX KIDS · "Bir çocuğun bir günü" turu (kids/assets/kids-gun.js), 10.11.2026
   Acadex kampüs turundaki gibi sahne ekrana sabitlenir; kaydırdıkça beş perde
   geçer: sabah okul → öğretmen seçimi → akşam giriş → oyun → yıldızlar.
   Gökyüzü kaydırmayla sabahtan geceye döner, güneş yay çizip aya dönüşür.
   Üstteki durak rayına dokununca o perdeye gidilir.
   Kısa mod (dar ekran ≤ 900 px, alçak ekran < 540 px, hareket azaltma, JS yok):
   sabitleme yok, perdeler kart olarak alt alta gelir ve görününce canlanır.
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, C = W.KIDS_CIZ, V = W.KIDS_VERI;
  var SAKIN = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var bolum, yap, panolar = [], ray = [], disk, kisa = null, son = -1, bekliyor = false, io = null;
  var N = 5;
  function cl(x) { return Math.max(0, Math.min(1, x)); }
  function R(id) { return V.RENK.filter(function (r) { return r.id === id; })[0].hex; }

  /* sınıftaki öğretmen: düz, kalın çizgili, maskotla aynı dil */
  function ogretmen() {
    var S = 'stroke="#23304D" stroke-width="3" stroke-linejoin="round"';
    return '<svg viewBox="0 0 70 110" aria-hidden="true">' +
      '<rect x="22" y="86" width="9" height="20" rx="4" fill="#23304D"/><rect x="39" y="86" width="9" height="20" rx="4" fill="#23304D"/>' +
      '<path d="M14 92 q0 -42 21 -44 q21 2 21 44 z" fill="#FF6B5B" ' + S + '/>' +
      '<path d="M52 58 q10 -6 14 -24" fill="none" stroke="#23304D" stroke-width="7" stroke-linecap="round"/><circle cx="66" cy="31" r="5" fill="#FFD3B0" ' + S + '/>' +
      '<circle cx="35" cy="28" r="20" fill="#5B3A29"/><circle cx="35" cy="31" r="15" fill="#FFD3B0" ' + S + '/>' +
      '<path d="M20 26 q15 -16 30 0 q-6 -4 -15 -4 q-9 0 -15 4z" fill="#5B3A29"/>' +
      '<circle cx="30" cy="31" r="2" fill="#23304D"/><circle cx="40" cy="31" r="2" fill="#23304D"/><path d="M30 37 q5 5 10 0" fill="none" stroke="#23304D" stroke-width="2.4" stroke-linecap="round"/></svg>';
  }
  function parmak() { return '<i class="kg-dokunus" aria-hidden="true"></i>'; }
  function tablet(ic) { return '<div class="kg-tab"><div class="kg-tab-e">' + ic + '</div></div>'; }

  var CIZIM = [
    /* 0 sabah: sınıf, tahtada renkler */
    function () {
      var renk = V.RENK.map(function (r, i) { return '<span class="kg-tahta-r" style="--i:' + i + '">' + C.leke(r.hex) + '</span>'; }).join('');
      return '<div class="kg-sinif"><div class="kg-tahta"><b lang="en">Colours</b><span class="kg-tahta-gk">' + C.simge('gokkusagi') + '</span><div class="kg-tahta-renk">' + renk + '</div></div>' +
        '<span class="kg-ogretmen">' + ogretmen() + '</span>' +
        '<div class="kg-cocuklar">' + ['tavsan', 'ayi', 'kedi', 'civciv'].map(function (a, i) { return '<span style="--i:' + i + '">' + C.avatar(a) + '</span>'; }).join('') + '</div></div>';
    },
    /* 1 öğle: öğretmen paneli, Colours seçilir */
    function () {
      var konu = ['colours', 'numbers', 'animals', 'food'].map(function (id) { var k = V.konuBul(id); return '<span class="kg-konu' + (id === 'colours' ? ' kg-sec' : '') + '" style="--r:' + k.renk + '"><i>' + C.simge(k.simge) + '</i><b lang="en">' + k.en + '</b>' + (id === 'colours' ? '<em class="kg-tik">' + C.simge('tik') + '</em>' : '') + '</span>'; }).join('');
      return '<div class="kg-panel"><div class="kg-panel-ust"><i></i><i></i><i></i><b>Öğretmen paneli</b></div>' +
        '<div class="kg-panel-ic"><p class="kg-panel-sinif">Papatyalar · bugün</p><p class="kg-panel-b">Günün konusu</p><div class="kg-konular">' + konu + '</div>' +
        '<p class="kg-panel-not">Çocuklar girişte <b lang="en">Colours</b> adasını görecek.</p></div>' +
        '<span class="kg-imlec" aria-hidden="true"><svg viewBox="0 0 30 30"><path d="M5 3 L25 15 L15 17 L10 27 Z" fill="#fff" stroke="#23304D" stroke-width="2.6" stroke-linejoin="round"/></svg></span></div>';
    },
    /* 2 akşam: resimli giriş */
    function () {
      var kim = ['tavsan', 'ayi', 'kedi'].map(function (a, i) { return '<span class="kg-kim' + (i === 0 ? ' kg-ben' : '') + '">' + C.avatar(a) + (i === 0 ? parmak() : '') + '</span>'; }).join('');
      return tablet('<div class="kg-giris"><div class="kg-kimler">' + kim + '</div><div class="kg-sifre"><span class="kg-s1">' + C.simge('kedi') + '</span><span class="kg-s2">' + C.simge('elma') + '</span><span class="kg-acik">' + C.simge('tik') + '</span></div></div>');
    },
    /* 3 akşam: balon oyunu */
    function () {
      var b = ['red', 'yellow', 'blue'].map(function (id, i) { return '<span class="kg-b' + (id === 'yellow' ? ' kg-hedef' : '') + '" style="--i:' + i + '">' + C.balon(R(id)) + (id === 'yellow' ? parmak() + '<i class="kg-pat"></i>' : '') + '</span>'; }).join('');
      return tablet('<div class="kg-oyun"><p class="kg-yonerge"><i>' + C.simge('ses') + '</i><span lang="en">Pop the <b style="--r:' + R('yellow') + '">yellow</b> balloon!</span></p><div class="kg-balonlar">' + b + '</div><p class="kg-nokta"><i></i><i></i><i class="kg-simdi"></i><i></i><i></i></p></div>');
    },
    /* 4 gece: yıldızlar + ertesi sabah öğretmenin gördüğü */
    function () {
      var y = [0, 1, 2].map(function (i) { return '<span style="--i:' + i + '">' + C.simge('yildiz') + '</span>'; }).join('');
      var n = [1, 1, 1, 1, 1, 0].map(function (x, i) { return '<i class="' + (x ? 'kg-oynadi' : '') + '" style="--i:' + i + '"></i>'; }).join('');
      return '<div class="kg-son">' + tablet('<div class="kg-yildiz"><div class="kg-yildizlar3">' + y + '</div><b lang="en">Great job!</b><span class="kg-cikartma">' + C.ada('#FF9EB5', 'gokkusagi', false) + '</span></div>') +
        '<div class="kg-rapor"><p><b>Ertesi sabah</b> · Papatyalar</p><div class="kg-rapor-n">' + n + '</div><p><b>5 / 6</b> çocuk dün oynadı</p><p class="kg-rapor-z">Zorlandığı kelime: <b lang="en">purple</b></p></div></div>';
    }
  ];

  function kur() {
    bolum = D.querySelector('[data-gun]'); if (!bolum) return;
    yap = bolum.querySelector('[data-kg-yap]'); disk = bolum.querySelector('[data-kg-gunes]');
    panolar = [].slice.call(bolum.querySelectorAll('.kg-pano'));
    ray = [].slice.call(bolum.querySelectorAll('[data-kg-git]'));
    panolar.forEach(function (p, i) {
      p.querySelector('[data-kg-cizim]').innerHTML = CIZIM[i]();
      var a = p.querySelector('[data-kg-acd]'); a.innerHTML = C.acadia({ mood: a.getAttribute('data-kg-acd'), pose: a.getAttribute('data-pose') });
    });
    bolum.querySelectorAll('[data-bulut]').forEach(function (e) { if (!e.firstChild) e.innerHTML = C.bulut(); });
    var yz = bolum.querySelector('.kg-yildizlar'), h = '';
    for (var k = 0; k < 18; k++) h += '<i style="left:' + ((k * 37) % 97 + 1.5) + '%;top:' + ((k * 23) % 46 + 3) + '%;--d:' + (k % 5) * .4 + 's"></i>';
    yz.innerHTML = h;
    ray.forEach(function (b) { b.addEventListener('click', function () { git(+b.getAttribute('data-kg-git')); }); });
    mod();
    W.addEventListener('scroll', iste, { passive: true });
    W.addEventListener('resize', function () { mod(); iste(); });
    D.addEventListener('kids:gorunum', function (e) { if (e.detail === 'tanitim') setTimeout(function () { mod(); iste(); }, 30); });
  }

  /* sabit tur mu, kısa mod mu */
  function mod() {
    var k = SAKIN || W.innerWidth <= 900 || W.innerHeight < 540;
    if (k === kisa) return; kisa = k; son = -1;
    bolum.classList.toggle('kg-pin', !k); bolum.classList.toggle('kg-kisa', k);
    panolar.forEach(function (p) { p.classList.remove('kg-aktif', 'kg-gecti'); p.removeAttribute('aria-hidden'); });
    if (io) { io.disconnect(); io = null; }
    if (k) {
      if (SAKIN || !W.IntersectionObserver) { panolar.forEach(function (p) { p.classList.add('kg-aktif'); }); return; }
      io = new W.IntersectionObserver(function (ee) { ee.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('kg-aktif'); io.unobserve(e.target); } }); }, { threshold: .35 });
      panolar.forEach(function (p) { io.observe(p); });
    } else iste();
  }

  function ilerleme() {
    var r = bolum.getBoundingClientRect(), yol = r.height - W.innerHeight;
    return yol > 0 ? cl(-r.top / yol) : 0;
  }
  function ciz() {
    bekliyor = false;
    if (kisa || D.getElementById('kl-sayfa').hidden) return;
    var p = ilerleme(), i = Math.min(N - 1, Math.floor(p * N));
    /* gökyüzü: sabah → gün batımı → gece */
    var a = cl(1 - (p - .25) / .3), c = cl((p - .66) / .26), b = Math.max(0, 1 - a - c);
    yap.style.setProperty('--a', a.toFixed(3)); yap.style.setProperty('--b', b.toFixed(3)); yap.style.setProperty('--c', c.toFixed(3));
    yap.style.setProperty('--p', p.toFixed(4));
    var u = cl(p / .9);
    disk.style.left = (43 + u * 15).toFixed(2) + '%';
    disk.style.top = (30 - Math.sin(Math.PI * u * .75) * 20).toFixed(2) + '%';
    yap.classList.toggle('kg-gece', c > .5);
    if (i === son) return; son = i;
    panolar.forEach(function (el, n) { el.classList.toggle('kg-aktif', n === i); el.classList.toggle('kg-gecti', n < i); el.setAttribute('aria-hidden', n === i ? 'false' : 'true'); });
    ray.forEach(function (bt, n) { bt.parentNode.classList.toggle('kg-r-aktif', n === i); bt.parentNode.classList.toggle('kg-r-gecti', n < i); if (n === i) bt.setAttribute('aria-current', 'step'); else bt.removeAttribute('aria-current'); });
  }
  function iste() { if (!bekliyor) { bekliyor = true; W.requestAnimationFrame(ciz); } }
  function git(n) {
    var r = bolum.getBoundingClientRect(), yol = r.height - W.innerHeight;
    W.scrollTo({ top: W.scrollY + r.top + yol * (n + .5) / N, behavior: 'smooth' });
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', kur); else kur();
  W.KIDS_GUN = { git: git, durum: function () { return { kisa: kisa, perde: son }; } };
})(window);
