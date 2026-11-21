/* ==========================================================================
   ACADEX KIDS · tanıtım sayfası kaydırma şöleni (kids/assets/kids-scroll.js), 15.11.2026
   1) Gökyüzü sabahtan geceye: sayfanın zemini bölümlerin yerine göre sabah mavisi → öğle →
      ikindi altını → gün batımı → alacakaranlık → yıldızlı gece (alttaki bilgi şeridiyle birleşir).
      Bulutlar, güneş, ay ve yıldızlar farklı derinliklerde kayar (paralaks).
   2) İçerik girişi: başlıklar maskeden yukarı kayar, kartlar sırayla yumuşakça gelir (15.11.2026 (2):
      harf harf hoplama ve jöle zıplaması kaldırıldı). Yumuşak kaydırma (masaüstü) ve fare/eğim derinliği.
   3) Hero: adalar kaydırdıkça açılır ve derinleşir; balonlu bir çocuk yükselip el sallar.
   Hareketi azalt açıksa: renkli zemin kalır, hiçbir şey hareket etmez, her şey baştan görünür.
   Çizimler özgündür (kids-ciz.js); dış kaynak yok.
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, C = W.KIDS_CIZ;
  var SAKIN = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ana, kat, hero, sahneH, derin = [], bekliyor = false, gozcu = null;

  /* ---------- 1) gökyüzü ---------- */
  /* [bölüm seçicisi, o bölümün başındaki renk]; arası yumuşak geçer. Son renk alt bilgi şeridinin rengi. */
  var DURAK = [
    [null, '#E4F5FF'], ['#bakis', '#D6F0FF'], ['#dene', '#CDEBFF'], ['#yas', '#FFF3D4'], ['#icerik-konular', '#FFDDB0'],
    ['.kl-guven', '#FFC9BE'], ['#fiyat', '#6E68C6'], ['#sss', '#2E3574'], [null, '#23304D']
  ];
  function ustY(el) { var y = 0; while (el && el !== ana) { y += el.offsetTop; el = el.offsetParent; } return y; }
  function rastgele(t) { var x = Math.sin(t * 9301 + 49297) * 233280; return x - Math.floor(x); }   /* her yüklemede aynı yerleşim */

  /* 20.11.2026: uzay yolculuğu (kids-yolculuk.js, html.kyo) açıksa gökyüzü, hero balonları ve
     yumuşak tekerlek burada kurulmaz: zemini evren, kaydırmayı GSAP sahneleri yönetir */
  var UZAY = function () { return D.documentElement.classList.contains('kyo'); };
  function gokKur() {
    if (UZAY()) { ana.classList.remove('kl-gok'); ana.style.backgroundImage = ''; if (kat) { kat.remove(); kat = null; } derin = []; return; }
    var H = ana.scrollHeight, durak = [];
    DURAK.forEach(function (d, i) {
      var y = i === 0 ? 0 : i === DURAK.length - 1 ? H : (d[0] && ana.querySelector(d[0]) ? ustY(ana.querySelector(d[0])) : -1);
      if (y >= 0) durak.push([y, d[1]]);
    });
    /* alacakaranlık bölümün ortasında morlaşır */
    var g = ana.querySelector('.kl-guven');
    if (g) durak.splice(durak.length - 3, 0, [ustY(g) + g.offsetHeight * 0.55, '#E2C4F2']);
    durak.sort(function (a, b) { return a[0] - b[0]; });
    ana.style.backgroundImage = 'linear-gradient(180deg,' + durak.map(function (d) { return d[1] + ' ' + Math.round(d[0]) + 'px'; }).join(',') + ')';
    ana.classList.add('kl-gok');

    /* derinlik katmanı: bulutlar (gündüz), güneş (gün batımı), ay ve yıldızlar (gece) */
    if (!kat) { kat = D.createElement('div'); kat.className = 'kl-gok-kat'; kat.setAttribute('aria-hidden', 'true'); ana.insertBefore(kat, ana.firstChild); }
    var w = ana.clientWidth, dar = w < 760, yKonu = ustY(ana.querySelector('#icerik-konular') || ana), yFiyat = ustY(ana.querySelector('#fiyat') || ana), html = '';
    derin = [];
    var ekle = function (cls, x, y, k, ic, stil) { derin.push({ y: y, k: k }); html += '<span class="' + cls + '" style="left:' + x.toFixed(1) + '%;top:' + Math.round(y) + 'px;' + (stil || '') + '">' + (ic || '') + '</span>'; };
    var nb = dar ? 7 : 14;
    for (var i = 0; i < nb; i++) {
      var y = 160 + rastgele(i + 1) * Math.max(200, yKonu - 200), k = [0.12, 0.25, 0.4][i % 3];
      ekle('kl-gb kl-gb' + (i % 3), rastgele(i + 31) * 92 - 4, y, k, C.bulut(), '--w:' + Math.round((dar ? 90 : 120) + k * (dar ? 160 : 300)) + 'px');
    }
    ekle('kl-gunes', dar ? 84 : 80, yKonu - (dar ? 230 : 120), dar ? 0.2 : 0.35, '<i></i>');
    for (var j = 0; j < (dar ? 26 : 54); j++) {
      var ys = yFiyat - 160 + rastgele(j + 101) * (ana.scrollHeight - yFiyat + 120);
      ekle('kl-yz' + (j % 5 === 0 ? ' kl-yz-b' : ''), rastgele(j + 201) * 98, ys, 0.06 + (j % 3) * 0.05, '', '--d:' + (rastgele(j + 301) * 3).toFixed(2) + 's');
    }
    ekle('kl-ay', dar ? 76 : 84, yFiyat + 40, 0.3, '<i></i>');
    ekle('kl-kayan', 10, yFiyat + 120, 0.1, '', '');
    kat.innerHTML = html;
    [].forEach.call(kat.children, function (el, n) { derin[n].el = el; });
  }
  function gokCiz() {
    if (SAKIN || !kat) return;
    var ust = ana.getBoundingClientRect().top + W.scrollY, orta = W.scrollY + W.innerHeight / 2 - ust, vh = W.innerHeight;
    for (var i = 0; i < derin.length; i++) {
      var d = derin[i], fark = orta - d.y;
      if (Math.abs(fark) > vh * 1.6) continue;
      d.el.style.transform = 'translate3d(0,' + (fark * d.k).toFixed(1) + 'px,0)';
    }
  }

  /* ---------- 2) içerik girişi: başlık maskeden yukarı kayar, kartlar sırayla yumuşakça gelir ---------- */
  var GIRIS = '.kl-soz,.kl-adimlar>li,.kl-guvenler>li,.kl-sss>details,.kt2-kart,.kl-dene-oyun,.kkn-bas>p,.kl-alt,.kb-sekmeler,.kb-paneller,.kl-dene-yazi>p,.kl-dene-yazi>.kl-dugme';
  var BASLIK = '.kl-bolum>h2,.kl-dene h2,.kkn-bas>h2,.kt2-sol>h2';
  function maskele(h) {
    if (h.querySelector('.kl-m')) return;
    var dis = D.createElement('span'), ic = D.createElement('span'); dis.className = 'kl-m'; ic.className = 'kl-m-ic';
    while (h.firstChild) ic.appendChild(h.firstChild);
    dis.appendChild(ic); h.appendChild(dis);
  }
  /* hero başlığı: satırlar (<br> ile ayrılmış) sayfa açılınca sırayla maskeden çıkar */
  function heroBaslik() {
    var h = D.querySelector('.kl-hero h1'); if (!h || h.dataset.satir) return; h.dataset.satir = '1';
    var satirlar = [[]]; [].slice.call(h.childNodes).forEach(function (c) { if (c.nodeType === 1 && c.tagName === 'BR') satirlar.push([]); else satirlar[satirlar.length - 1].push(c); });
    h.innerHTML = '';
    satirlar.forEach(function (s, i) {
      var dis = D.createElement('span'), ic = D.createElement('span'); dis.className = 'kl-m kl-m-satir'; ic.className = 'kl-m-ic'; ic.style.setProperty('--i', i);
      s.forEach(function (c) { ic.appendChild(c); }); dis.appendChild(ic); h.appendChild(dis);
    });
    W.requestAnimationFrame(function () { h.classList.add('kl-geldi'); });
  }
  function girisKur() {
    if (SAKIN || !('IntersectionObserver' in W)) return;
    D.documentElement.classList.add('kl-giris-hazir');
    heroBaslik();
    var liste = [].slice.call(ana.querySelectorAll(GIRIS)), baslik = [].slice.call(ana.querySelectorAll(BASLIK));
    baslik.forEach(maskele);
    liste.forEach(function (el) { var k = el.parentNode ? [].indexOf.call(el.parentNode.children, el) : 0; el.style.setProperty('--zi', k % 8); el.classList.add('kl-gir'); });
    baslik.forEach(function (el) { el.classList.add('kl-gir-h'); });
    gozcu = new W.IntersectionObserver(function (gir) {
      gir.forEach(function (g) { if (g.isIntersecting) { g.target.classList.add('kl-geldi'); gozcu.unobserve(g.target); } });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    liste.concat(baslik).forEach(function (el) { gozcu.observe(el); });
  }

  /* ---------- yumuşak kaydırma (masaüstü tekerlek): ataletle akar; dokunmatik ve klavye doğal kalır ---------- */
  var hedefY = 0, simdiY = 0, akiyor = false, yumusakAcik = false;
  function sinirla(y) { return Math.max(0, Math.min(D.documentElement.scrollHeight - W.innerHeight, y)); }
  function akis() {
    simdiY += (hedefY - simdiY) * 0.11;
    if (Math.abs(hedefY - simdiY) < 0.5) { simdiY = hedefY; akiyor = false; }
    W.scrollTo(0, simdiY);
    if (akiyor) W.requestAnimationFrame(akis);
  }
  function kaydir(y) {
    if (!yumusakAcik) { W.scrollTo({ top: y, behavior: SAKIN ? 'auto' : 'smooth' }); return; }
    hedefY = sinirla(y); if (!akiyor) { simdiY = W.scrollY; akiyor = true; W.requestAnimationFrame(akis); }
  }
  function kaydirilabilir(el) {
    for (; el && el !== D.body && el.nodeType === 1; el = el.parentNode) {
      if (el.closest && el.closest('.ktf,.kr-katman,.ku')) return true;
      var s = getComputedStyle(el).overflowY; if ((s === 'auto' || s === 'scroll') && el.scrollHeight > el.clientHeight) return true;
    }
    return false;
  }
  function yumusakKur() {
    if (SAKIN || !W.matchMedia || !W.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (UZAY()) return;
    yumusakAcik = true;
    W.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.defaultPrevented || D.getElementById('kl-sayfa').hidden || kaydirilabilir(e.target)) return;
      var d = e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? W.innerHeight : 1);
      if (!d) return;
      e.preventDefault();
      if (!akiyor) { simdiY = W.scrollY; hedefY = W.scrollY; }
      hedefY = sinirla(hedefY + d); if (!akiyor) { akiyor = true; W.requestAnimationFrame(akis); }
    }, { passive: false });
    /* klavye, kaydırma çubuğu, bağlantı: akışı bırak */
    ['keydown', 'mousedown', 'touchstart'].forEach(function (t) { W.addEventListener(t, function () { if (akiyor) { akiyor = false; hedefY = simdiY = W.scrollY; } }, { passive: true }); });
  }

  /* ---------- fare ve telefon eğimi: --mx, --my (-1..1) ---------- */
  function egimKur() {
    if (SAKIN) return;
    var kok = D.getElementById('kl-sayfa'), hx = 0, hy = 0, x = 0, y = 0, donuyor = false;
    var don = function () { x += (hx - x) * 0.08; y += (hy - y) * 0.08; kok.style.setProperty('--mx', x.toFixed(3)); kok.style.setProperty('--my', y.toFixed(3)); if (Math.abs(hx - x) > 0.002 || Math.abs(hy - y) > 0.002) W.requestAnimationFrame(don); else donuyor = false; };
    var iste2 = function () { if (!donuyor) { donuyor = true; W.requestAnimationFrame(don); } };
    W.addEventListener('pointermove', function (e) { if (e.pointerType !== 'mouse' || kok.hidden) return; hx = (e.clientX / W.innerWidth) * 2 - 1; hy = (e.clientY / W.innerHeight) * 2 - 1; iste2(); }, { passive: true });
    /* telefon: izin istemeyen tarayıcılarda (Android) eğim; iOS izin penceresi açılmaz */
    W.addEventListener('deviceorientation', function (e) { if (e.gamma == null || kok.hidden) return; hx = Math.max(-1, Math.min(1, e.gamma / 25)); hy = Math.max(-1, Math.min(1, (e.beta - 40) / 25)); iste2(); }, { passive: true });
  }

  /* ---------- 3) hero: açılan adalar ve balonlu çocuk ---------- */
  /* özgün çizim: iki kollu, balon iplerini tutan minik çocuk (belirli bir karakter değildir) */
  function cocuk() {
    var M = '#23304D';
    return '<svg class="kc" viewBox="0 0 120 220" aria-hidden="true">' +
      '<g class="kl-cb-ip" fill="none" stroke="' + M + '" stroke-width="2"><path d="M60 118 L34 52"/><path d="M60 118 L60 40"/><path d="M60 118 L88 54"/></g>' +
      '<g stroke="' + M + '" stroke-width="3"><ellipse class="kl-cb1" cx="30" cy="34" rx="18" ry="22" fill="#E5484D"/><ellipse class="kl-cb2" cx="60" cy="22" rx="18" ry="22" fill="#FFD23F"/><ellipse class="kl-cb3" cx="90" cy="36" rx="18" ry="22" fill="#4AA8FF"/></g>' +
      '<g fill="#fff" opacity=".7"><ellipse cx="24" cy="26" rx="4" ry="7"/><ellipse cx="54" cy="14" rx="4" ry="7"/><ellipse cx="84" cy="28" rx="4" ry="7"/></g>' +
      '<path d="M52 196 l-4 18 h10 l2 -18 z M68 196 l4 18 h-10 l-2 -18 z" fill="' + M + '"/>' +
      '<path d="M42 150 q18 -12 36 0 l6 48 h-48 z" fill="#4CC38A" stroke="' + M + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M44 158 q-10 -20 14 -38" fill="none" stroke="' + M + '" stroke-width="7" stroke-linecap="round"/><path d="M44 158 q-10 -20 14 -38" fill="none" stroke="#FFCFA8" stroke-width="3.5" stroke-linecap="round"/>' +
      '<g class="kl-cb-el"><path d="M76 158 q16 -10 18 -30" fill="none" stroke="' + M + '" stroke-width="7" stroke-linecap="round"/><path d="M76 158 q16 -10 18 -30" fill="none" stroke="#FFCFA8" stroke-width="3.5" stroke-linecap="round"/><circle cx="94" cy="126" r="6" fill="#FFCFA8" stroke="' + M + '" stroke-width="3"/></g>' +
      '<circle cx="58" cy="120" r="5" fill="#FFCFA8" stroke="' + M + '" stroke-width="3"/>' +
      '<circle cx="60" cy="134" r="22" fill="#FFCFA8" stroke="' + M + '" stroke-width="3"/>' +
      '<path d="M38 132 q2 -24 22 -24 q20 0 22 22 q-10 -10 -22 -10 q-14 0 -22 12 z" fill="#7A4A2A" stroke="' + M + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<circle cx="52" cy="136" r="2.6" fill="' + M + '"/><circle cx="68" cy="136" r="2.6" fill="' + M + '"/>' +
      '<path d="M53 145 q7 6 14 0" fill="none" stroke="' + M + '" stroke-width="2.6" stroke-linecap="round"/>' +
      '<ellipse cx="46" cy="143" rx="4" ry="2.6" fill="#FF9E8A" opacity=".8"/><ellipse cx="74" cy="143" rx="4" ry="2.6" fill="#FF9E8A" opacity=".8"/></svg>';
  }
  function heroKur() {
    if (UZAY()) return;
    hero = D.querySelector('.kl-hero'); sahneH = hero && hero.querySelector('.kl-hero-sahne');
    if (!sahneH || sahneH.querySelector('.kl-hero-cocuk')) return;
    var s = D.createElement('span'); s.className = 'kl-hero-cocuk'; s.innerHTML = cocuk(); sahneH.appendChild(s);
  }
  function heroCiz() {
    if (SAKIN || !hero) return;
    var r = hero.getBoundingClientRect(), p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
    if (r.bottom < -50) return;
    sahneH.style.setProperty('--hp', p.toFixed(3));
  }

  /* ---------- çerçeve ---------- */
  function ciz() { bekliyor = false; if (D.getElementById('kl-sayfa').hidden) return; gokCiz(); heroCiz(); }
  function iste() { if (!bekliyor) { bekliyor = true; W.requestAnimationFrame(ciz); } }
  var zaman = null;
  function yeniden() { clearTimeout(zaman); zaman = setTimeout(function () { gokKur(); iste(); }, 60); }
  function kur() {
    ana = D.getElementById('icerik'); if (!ana || !C) return;
    heroKur(); gokKur(); girisKur(); yumusakKur(); egimKur(); iste();
    W.addEventListener('scroll', iste, { passive: true }); W.addEventListener('resize', yeniden);
    if (W.ResizeObserver) { var son = 0; new W.ResizeObserver(function () { var h = ana.scrollHeight; if (Math.abs(h - son) > 40) { son = h; yeniden(); } }).observe(ana); }
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(yeniden);
    D.addEventListener('kids:gorunum', function (e) { if (e.detail === 'tanitim') yeniden(); });
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', kur); else kur();
  W.KIDS_SCROLL = { maskele: maskele, cocuk: cocuk, DURAK: DURAK, yeniden: yeniden, kaydir: kaydir };
})(window);
