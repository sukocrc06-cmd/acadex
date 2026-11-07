/* ==========================================================================
   ACADEX ENGLISH · ortak davranışlar (assets/ing.js), 05.11.2026
     ACX.soyle(metin, ms)   Acadia konuşur        ACX.sevin() / ACX.uz()   tepki
     ACX.test(el, sorular, {panel, id})          tek tek sorulan çoktan seçmeli set
     ACX.bitir(panel, id) / ACX.bitenler(panel)  ilerleme (tarayıcıda kalır)
     ACX.ses(metin, hiz)    İngilizce seslendirme (tarayıcının sesi)
   Kaydırma sahnesi: <section class="sahne" data-adim="4"> … ; her adımda
   sahneye data-a="0..3" yazılır ve 'adim' olayı yayılır.
   ========================================================================== */
(function () {
  'use strict';
  var D = document, W = window;
  var sakin = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ls = {
    al: function (k, v) { try { var x = localStorage.getItem('acx.ing.' + k); return x ? JSON.parse(x) : v; } catch (e) { return v; } },
    yaz: function (k, v) { try { localStorage.setItem('acx.ing.' + k, JSON.stringify(v)); } catch (e) { /* gizli pencere */ } }
  };

  /* ---------- girişler ---------- */
  var gozcu = 'IntersectionObserver' in W ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('gir'); gozcu.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -12% 0px', threshold: .08 }) : null;
  function girisler(kok) { (kok || D).querySelectorAll('[data-gir]:not(.gir)').forEach(function (el) { if (gozcu && !sakin) gozcu.observe(el); else el.classList.add('gir'); }); }

  /* ---------- kaydırma sahneleri ---------- */
  var sahneler = [];
  function sahneKur() {
    sahneler = [].slice.call(D.querySelectorAll('.sahne')).map(function (s) {
      var n = +s.dataset.adim || 4; s.style.setProperty('--adim', n);
      return { el: s, n: n, a: -1, li: [].slice.call(s.querySelectorAll('.adimlar li')) };
    });
    var bekle = false;
    var tik = function () {
      bekle = false; var vh = W.innerHeight;
      sahneler.forEach(function (o) {
        var r = o.el.getBoundingClientRect(), boy = o.el.offsetHeight - vh * .9;
        var p = Math.min(1, Math.max(0, -r.top / Math.max(1, boy)));
        o.el.style.setProperty('--p', p.toFixed(4));
        var a = Math.min(o.n - 1, Math.floor(p * o.n * .999));
        if (a !== o.a) {
          o.a = a; o.el.dataset.a = a;
          for (var k = 0; k < o.n; k++) o.el.classList.toggle('a' + k, k <= a);   /* birikimli: a2 varsa a0, a1 de var */
          o.li.forEach(function (li, i) { li.classList.toggle('on', i === a); });
          o.el.dispatchEvent(new CustomEvent('adim', { detail: a }));
        }
      });
    };
    var iste = function () { if (!bekle) { bekle = true; requestAnimationFrame(tik); } };
    W.addEventListener('scroll', iste, { passive: true }); W.addEventListener('resize', iste); tik();
    /* adıma tıklayınca o adıma kaydır */
    sahneler.forEach(function (o) {
      o.li.forEach(function (li, i) {
        li.tabIndex = 0;
        var git = function () { var top = o.el.getBoundingClientRect().top + W.scrollY, boy = o.el.offsetHeight - W.innerHeight * .9; W.scrollTo({ top: top + boy * (i + .5) / o.n, behavior: sakin ? 'auto' : 'smooth' }); };
        li.addEventListener('click', git); li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); git(); } });
      });
    });
  }

  /* ---------- Acadia (kostümlü) ---------- */
  var INK = '#1A2A5C';
  var KOSTUM = {
    vocab: '<g class="kos"><path d="M30 30 h22 M33 30 c-3 -10 -1 -18 -3 -26 h22 c-2 8 0 16 -3 26" fill="#C2462F" fill-opacity=".85" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><path d="M30 4 h22" stroke="' + INK + '" stroke-width="3"/><path class="buhar" d="M37 -2 c-4 -6 4 -9 0 -15 M45 -2 c-4 -6 4 -9 0 -15" fill="none" stroke="#8A93AE" stroke-width="2.5" stroke-linecap="round"/></g>',
    listening: '<g class="kos"><path d="M-30 -10 C-32 -50 32 -50 30 -10" fill="none" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/><rect x="-39" y="-18" width="13" height="22" rx="6" fill="#0F8582" stroke="' + INK + '" stroke-width="3"/><rect x="26" y="-18" width="13" height="22" rx="6" fill="#0F8582" stroke="' + INK + '" stroke-width="3"/></g>',
    reading: '<g class="kos"><circle cx="-10" cy="-4" r="10.5" fill="none" stroke="' + INK + '" stroke-width="2.6"/><circle cx="10" cy="-4" r="10.5" fill="none" stroke="' + INK + '" stroke-width="2.6"/><path d="M-0.5 -5 h1" stroke="' + INK + '" stroke-width="2.6"/><path d="M24 26 l20 -6 l4 16 l-20 6 z" fill="#2C7A4B" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><path d="M28 28 l14 -4" stroke="#F5EFE2" stroke-width="2"/></g>',
    speaking: '<g class="kos"><path d="M30 14 h20 v12 a10 10 0 0 1 -10 10 h0 a10 10 0 0 1 -10 -10 z" fill="#F5EFE2" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><path d="M50 18 a6 6 0 0 1 0 10" fill="none" stroke="' + INK + '" stroke-width="3"/><path d="M33 14 h14" stroke="#7A4A2A" stroke-width="3"/><path d="M-50 -30 q-4 -14 12 -16 h16 q14 2 10 14 q-4 10 -16 9 l-10 7 l2 -8 q-10 -1 -14 -6z" fill="#fff" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/><text x="-36" y="-30" font-family="Caveat,cursive" font-size="13" font-weight="700" fill="' + INK + '">hi!</text></g>',
    writing: '<g class="kos"><path d="M-16 -30 C -10 -44 10 -50 26 -48 C 36 -46 44 -56 52 -66" fill="none"/><path d="M-18 -28 C-12 -46 8 -54 30 -50 C 40 -48 46 -58 50 -66 L 54 -62 C 50 -46 40 -36 18 -30 Z" fill="#6E9BFF" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><path d="M-4 -40 l6 10 M10 -45 l6 12 M24 -46 l4 12" stroke="#fff" stroke-width="2.4"/><circle cx="52" cy="-66" r="7" fill="#fff" stroke="' + INK + '" stroke-width="3"/><path d="M-20 -28 C -4 -24 10 -26 20 -30" fill="none" stroke="' + INK + '" stroke-width="3"/></g>',
    hub: '<g class="kos"><path d="M-30 -40 L0 -54 L30 -40 L0 -26 Z" fill="' + INK + '" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/><path d="M-16 -34 v10 q16 8 32 0 v-10" fill="' + INK + '"/><path d="M24 -42 v18" stroke="#FFD86B" stroke-width="2.5"/><circle cx="24" cy="-22" r="3.5" fill="#FFD86B"/></g>'
  };
  function acadiaSvg(kos) {
    return '<svg viewBox="-62 -70 132 132" aria-hidden="true"><g class="gov"><path d="M0 -52 C7 -19 19 -7 52 0 C19 7 7 19 0 52 C-7 19 -19 7 -52 0 C-19 -7 -7 -19 0 -52 Z" fill="#FFD86B" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>' +
      '<ellipse cx="-17" cy="11" rx="6" ry="3.5" fill="#F29C94"/><ellipse cx="17" cy="11" rx="6" ry="3.5" fill="#F29C94"/>' +
      '<g class="kirp" style="transform-origin:0 -4px"><ellipse cx="-10" cy="-4" rx="6.5" ry="8" fill="#fff" stroke="' + INK + '" stroke-width="2.5"/><ellipse cx="10" cy="-4" rx="6.5" ry="8" fill="#fff" stroke="' + INK + '" stroke-width="2.5"/><g class="bebek"><circle cx="-9" cy="-3" r="3.6" fill="' + INK + '"/><circle cx="11" cy="-3" r="3.6" fill="' + INK + '"/></g></g>' +
      '<path d="M-6 10 Q0 16 6 10" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>' + (KOSTUM[kos] || '') + AKSESUAR + '</g></svg>';
  }
  /* saate göre aksesuar (html[data-isik]): sabah papyon, öğle yaka rozeti, akşam atkı, gece mum */
  var AKSESUAR = '<g class="aks aks-sabah"><path d="M-9 26 l-9 -6 v12 z M9 26 l9 -6 v12 z" fill="#DD5A36" stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round"/><circle cx="0" cy="26" r="3.6" fill="#DD5A36" stroke="' + INK + '" stroke-width="2.2"/></g>' +
    '<g class="aks aks-ogle"><circle cx="20" cy="24" r="7" fill="#fff" stroke="' + INK + '" stroke-width="2.2"/><path d="M20 19.5 l1.4 3 3.2 .3 -2.4 2.1 .7 3.1 -2.9 -1.6 -2.9 1.6 .7 -3.1 -2.4 -2.1 3.2 -.3z" fill="#E3A80F"/></g>' +
    '<g class="aks aks-aksam"><path d="M-22 18 q22 12 44 0 l2 7 q-24 13 -48 0 z" fill="#C93B2B" stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round"/><path d="M14 24 l5 18 l6 -2 l-4 -16" fill="#C93B2B" stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round"/></g>' +
    '<g class="aks aks-gece"><rect x="-58" y="14" width="10" height="18" rx="2" fill="#F5EFE2" stroke="' + INK + '" stroke-width="2.2"/><path class="alev" d="M-53 13 c-4 -5 0 -9 0 -12 c3 4 4 8 0 12z" fill="#FFB547" stroke="' + INK + '" stroke-width="1.5"/></g>' +
    '<g class="zzz"><text x="30" y="-40">z</text><text x="40" y="-52">z</text><text x="50" y="-64">Z</text></g>';
  var ACADIA = '';
  /* ---------- gezgin Acadia: başlıklara konar, kaydırmayı izler, dokununca yardım menüsü ---------- */
  var ac, balon, metinEl, zaman, menu, ax = 0, ay = 0, durgun = 0;
  var dar = function () { return W.innerWidth < 760; };
  var boy = function () { return dar() ? 50 : 74; };
  function konum(x, y, hizli) {
    var b = boy(); x = Math.max(6, Math.min(W.innerWidth - b - 6, x)); y = Math.max(70, Math.min(W.innerHeight - b - 6, y));
    if (Math.abs(x - ax) > 4) ac.classList.toggle('ters', x < ax);
    var uzak = Math.hypot(x - ax, y - ay) > 40;
    ax = x; ay = y; ac.classList.toggle('sol', x < Math.min(320, W.innerWidth * .45));
    if (uzak && !hizli && !sakin) { ac.classList.add('ucuyor'); clearTimeout(ac._u); ac._u = setTimeout(function () { ac.classList.remove('ucuyor'); }, 900); }
    ac.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)'; durgun = Date.now();
  }
  function ev() { var b = boy(); konum(W.innerWidth - b - (dar() ? 8 : 18), W.innerHeight - b - (dar() ? 8 : 16)); }
  function kon() {
    if (!ac || sakin || ac.classList.contains('mesgul')) return;
    if (dar()) return ev();
    var b = boy(), en = null, ed = 1e9, hedefY = W.innerHeight * .34;
    D.querySelectorAll('.kah h1, .bolum-b h2, .alis-u h3, .hoca-ust, .sonraki b').forEach(function (h) {
      var r = h.getBoundingClientRect(); if (r.top < 96 || r.top > W.innerHeight * .62 || r.width < 40) return;
      var d = Math.abs(r.top - hedefY); if (d < ed) { ed = d; en = r; }
    });
    if (!en) return ev();
    var x = en.right + 8 + b > W.innerWidth - 8 ? en.right - b : en.right + 8;
    konum(x, en.top - b * .62);
  }
  function acadiaKur() {
    ac = D.createElement('div'); ac.className = 'acadia';
    ac.innerHTML = '<div class="balon" role="status" aria-live="polite"><span></span><button type="button" aria-label="Kapat">×</button></div>' +
      '<div class="acadia-menu" role="menu" aria-label="Acadia yardım" hidden>' +
        '<button type="button" role="menuitem" data-ym="ipucu"><b>💡</b> Bu soruda ipucu</button>' +
        '<button type="button" role="menuitem" data-ym="sayfa"><b>📖</b> Bu sayfada ne yapıyorum?</button>' +
        '<button type="button" role="menuitem" data-ym="defter"><b>📒</b> Defterim</button>' +
        '<button type="button" role="menuitem" data-ym="kelime"><b>🔤</b> Kelime açıkla</button></div>' +
      '<button type="button" class="acadia-d" aria-label="Acadia: yardım menüsü" aria-haspopup="menu" aria-expanded="false">' + acadiaSvg(D.body.dataset.panel || 'hub') + '</button>';
    D.body.appendChild(ac); balon = ac.querySelector('.balon'); metinEl = balon.querySelector('span'); menu = ac.querySelector('.acadia-menu');
    var dug = ac.querySelector('.acadia-d');
    balon.querySelector('button').onclick = function () { balon.classList.remove('acik'); };
    dug.onclick = function () { var ac_ = menu.hidden; menuAc(ac_); if (ac_) tepki('sevin', true); };
    menu.addEventListener('click', function (e) { var b = e.target.closest('[data-ym]'); if (!b) return; menuAc(false); YARDIM[b.dataset.ym](); });
    D.addEventListener('keydown', function (e) { if (e.key === 'Escape') { menuAc(false); kartKapat(); } });
    D.addEventListener('pointerdown', function (e) { if (!menu.hidden && !ac.contains(e.target)) menuAc(false); });
    ev();
    /* kaydırırken uçar, durunca en yakın başlığa konar; boşta etrafına bakınır */
    var t = null;
    W.addEventListener('scroll', function () { if (sakin) return; ac.classList.add('ucuyor'); clearTimeout(t); t = setTimeout(function () { ac.classList.remove('ucuyor'); kon(); }, 420); }, { passive: true });
    W.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(kon, 200); });
    setTimeout(kon, 900);
    if (!sakin) setInterval(function () { if (Date.now() - durgun > 7000 && !ac.classList.contains('mesgul')) { ac.classList.remove('bakin'); void ac.offsetWidth; ac.classList.add('bakin'); durgun = Date.now(); } }, 2500);
    /* bölüme girince bir kez konuşur */
    var g = 'IntersectionObserver' in W ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { soyle(e.target.dataset.acadia, 5200); g.unobserve(e.target); } });
    }, { threshold: .35 }) : null;
    D.querySelectorAll('[data-acadia]').forEach(function (el) { if (g) g.observe(el); });
    kelimeKur();
  }
  function menuAc(on) { if (!menu) return; menu.hidden = !on; ac.classList.toggle('mesgul', on); ac.querySelector('.acadia-d').setAttribute('aria-expanded', on); if (on) { balon.classList.remove('acik'); menu.querySelector('button').focus({ preventScroll: true }); } }

  /* yardım menüsü */
  var PANEL_ANLAT = {
    vocab: 'Kahvaltı durağı: sabah destesi aralıklı tekrarla çalışır, sonra kalıp, kelime ailesi ve akademik karşılık soruları. Defne Hoca kelimeyle cümle kurdurur.',
    listening: 'Otobüs durağı: dikte, saat-tarih-sayı, ship mi sheep mi, kayıt ofisi diyaloğu. Defne Hoca cümle okur, sen yazarsın.',
    reading: 'Kütüphane durağı: önce göz gezdir, sonra ana fikir. Defne Hoca metinle ilgili açık uçlu soru sorar; takılırsan bana bas.',
    speaking: 'Kafe durağı: konu kartı, vurgu, doğal geçişler, gölge okuma. Defne Hoca seninle beş turluk sohbet eder.',
    writing: 'Yurt odası durağı: kırmızı kalemli düzeltme, bağlaçlar, paragraf sırası, tez cümlesi. Defne Hoca ile cümle cümle paragraf yazarsınız.',
    '': 'Defterin ana sayfası: beş durak, haftalık seri takvimi ve şu an hangi panelin sırası olduğu.'
  };
  function gorunurMu(el) { var r = el.getBoundingClientRect(); return r.bottom > 80 && r.top < W.innerHeight - 40; }
  var YARDIM = {
    ipucu: function () {
      var hb = [].slice.call(D.querySelectorAll('#hoca [data-ipucu]')).filter(function (b) { return gorunurMu(b) && !b.disabled; })[0];
      if (hb) { hb.click(); soyle('Hocaya çaktırmadan söyledim; yukarıdaki fısıltıya bak.', 4000); return; }
      var t = [].slice.call(D.querySelectorAll('[data-dogru]')).filter(gorunurMu)[0];
      if (t && !t.dataset.elendi) {
        var yanlis = [].slice.call(t.querySelectorAll('.sec button')).filter(function (b) { return !b.disabled && +b.dataset.k !== +t.dataset.dogru; });
        if (yanlis.length > 1) { var b = yanlis[Math.floor(Math.random() * yanlis.length)]; b.disabled = true; b.classList.add('elendi'); t.dataset.elendi = 1; konBuraya(b); soyle('Bir şıkkı eledim: “' + b.textContent + '” değil.', 4500); return; }
      }
      var ip = D.body.dataset.ipucu ? D.body.dataset.ipucu.split('|') : ['Önce soruyu kendi cümlenle söyle; cevap çoğu zaman oradan çıkar.'];
      soyle(ip[Math.floor(Math.random() * ip.length)], 6000);
    },
    sayfa: function () {
      var nerede = [['#hoca', 'Şu an Defne Hoca’nın bölümündesin.'], ['#calis', 'Şu an alıştırmalardasın; bitenlerin yanına tik düşer.'], ['.sahne', 'Şu an kaydırmalı gösterimdesin; kaydırdıkça adımlar ilerler.'], ['#hafta', 'Şu an haftalık takvimdesin.']].filter(function (x) { var e = D.querySelector(x[0]); return e && gorunurMu(e); })[0];
      soyle((PANEL_ANLAT[D.body.dataset.panel || ''] || '') + (nerede ? ' ' + nerede[1] : ''), 9000);
    },
    defter: function () {
      var p = D.body.dataset.panel, h = ls.al('hoca', {}), g = gunluk(), seri = 0, c = new Date(); c.setHours(0, 0, 0, 0); if (!g[gunAnahtar(c)]) c.setDate(c.getDate() - 1);
      while (g[gunAnahtar(c)]) { seri++; c.setDate(c.getDate() - 1); }
      var m = p ? p.charAt(0).toUpperCase() + p.slice(1) + ': ' + Math.min(4, Object.keys(bitenler(p)).length) + '/4 alıştırma, Defne Hoca oturumu ' + (h[p] ? 'tamam' : 'henüz yok') + '. ' : PANEL.map(function (x) { return x.ad + ' ' + Math.min(4, Object.keys(bitenler(x.id)).length) + '/4'; }).join(' · ') + '. ';
      soyle(m + (seri ? seri + ' günlük serin var.' : 'Bugün bir alıştırma bitirirsen seri başlar.'), 8000);
    },
    kelime: function () { soyle('Sayfada bir İngilizce kelimeyi seç (bilgisayarda çift tıkla, telefonda basılı tut). Anlamını, okunuşunu getiririm, istersen desteye eklerim.', 7000); }
  };
  function konBuraya(el) { if (sakin || dar()) return; var r = el.getBoundingClientRect(), b = boy(); konum(r.right + 6, r.top - b * .5); }

  /* seçili kelime: anlamı, okunuşu, sesi; desteye ekle (acx.ing.desteEk, Vocab sayfası yüklenince alır) */
  var cip = null, kart = null, sozlukYerel = {};
  function sozlukEkle(liste) { (liste || []).forEach(function (k) { if (k && k.kelime) sozlukYerel[String(k.kelime).toLowerCase()] = k; }); }
  function secim() {
    var s = W.getSelection && W.getSelection(); if (!s || s.isCollapsed || !s.rangeCount) return null;
    var t = String(s).trim().replace(/[.,;:!?“”"()]+$/g, '').replace(/^[“”"(]+/, '');
    if (!/^[A-Za-z][A-Za-z'’-]*( [A-Za-z'’-]+){0,2}$/.test(t) || t.length > 32) return null;
    var n = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
    if (!n || n.closest('textarea,input,.acadia,.kelime-kart,.ust')) return null;
    return { t: t, r: s.getRangeAt(0).getBoundingClientRect() };
  }
  function kelimeKur() {
    var bak = function () { setTimeout(function () { var s = secim(); cipGoster(s); }, 30); };
    D.addEventListener('mouseup', bak); D.addEventListener('touchend', bak); D.addEventListener('keyup', function (e) { if (e.shiftKey) bak(); });
    D.addEventListener('selectionchange', function () { if (cip && !secim()) cipGoster(null); });
    W.addEventListener('scroll', function () { if (cip) cipGoster(null); }, { passive: true });
  }
  function cipGoster(s) {
    if (!s) { if (cip) { cip.remove(); cip = null; } return; }
    if (!cip) { cip = D.createElement('button'); cip.type = 'button'; cip.className = 'kelime-cip'; D.body.appendChild(cip); }
    cip.innerHTML = '<span class="el">Acadia:</span> “' + esc(s.t) + '” ne demek?';
    var x = Math.max(8, Math.min(W.innerWidth - 230, s.r.left + s.r.width / 2 - 100)), y = s.r.bottom + 8 > W.innerHeight - 60 ? s.r.top - 46 : s.r.bottom + 8;
    cip.style.left = x + 'px'; cip.style.top = y + 'px';
    cip.onmousedown = function (e) { e.preventDefault(); };
    cip.onclick = function () { var r = s.r; try { W.getSelection().removeAllRanges(); } catch (e) {} cipGoster(null); kelimeAc(s.t, r); };
  }
  function kartKapat() { if (kart) { kart.remove(); kart = null; } if (ac) ac.classList.remove('mesgul'); }
  async function kelimeAc(t, r) {
    kartKapat(); var k = t.toLowerCase().replace(/’/g, "'");
    ac.classList.add('mesgul');
    if (!dar() && !sakin) konum(r.right + 10, r.top - boy() * .7);
    kart = D.createElement('div'); kart.className = 'kelime-kart kagit'; kart.setAttribute('role', 'dialog'); kart.setAttribute('aria-label', t + ' kelimesi');
    var x = Math.max(8, Math.min(W.innerWidth - 300, r.left - 20)), y = r.bottom + 10 + 230 > W.innerHeight ? Math.max(76, r.top - 240) : r.bottom + 10;
    kart.style.left = x + 'px'; kart.style.top = y + 'px';
    kart.innerHTML = '<button type="button" class="x" aria-label="Kapat">×</button><b lang="en">' + esc(t) + '</b><p class="el">Acadia bakıyor…</p>';
    D.body.appendChild(kart); kart.querySelector('.x').onclick = kartKapat;
    var v = sozlukYerel[k] || null;
    if (!v) { var j = await yz('sozluk', { kelime: k }, 12000); v = j && j.veri; }
    if (!kart) return;
    var ek = ls.al('desteEk', []) || [], varMi = ek.some(function (x) { return x[0] === k; }) || !!sozlukYerel[k] && D.body.dataset.panel === 'vocab';
    kart.innerHTML = '<button type="button" class="x" aria-label="Kapat">×</button><b lang="en">' + esc(t) + '</b>' + (v && v.okunus ? ' <span class="mono">' + esc(v.okunus) + (v.tur ? ' · ' + esc(v.tur) : '') + '</span>' : '') +
      (v && v.anlam_tr ? '<p class="anlam">' + esc(v.anlam_tr) + '</p>' + (v.ornek ? '<p class="ornek" lang="en">' + esc(v.ornek) + '</p>' : '') + (v.ornek_tr ? '<p class="ornek-tr">' + esc(v.ornek_tr) + '</p>' : '') : '<p class="say">Anlamını şu an getiremedim; bağlantı gelince yine dene.</p>') +
      '<div class="dugmeler" style="gap:6px"><button type="button" class="btn sm" data-k="dinle">▶ dinle</button>' + (v && v.anlam_tr ? '<button type="button" class="btn sm ana" data-k="ekle"' + (varMi ? ' disabled' : '') + '>' + (varMi ? 'destende var' : '+ desteye ekle') + '</button>' : '') + '</div>';
    kart.querySelector('.x').onclick = kartKapat;
    kart.querySelector('[data-k=dinle]').onclick = function () { ses(t, .85); };
    var eb = kart.querySelector('[data-k=ekle]');
    if (eb) eb.onclick = function () {
      var e2 = ls.al('desteEk', []) || []; if (!e2.some(function (x) { return x[0] === k; })) e2.push([k, (v.okunus || '') + (v.tur ? ' · ' + v.tur : ''), v.anlam_tr, v.ornek || '']); ls.yaz('desteEk', e2);
      eb.disabled = true; eb.textContent = 'desteye eklendi'; tepki('sevin'); soyle('Kahvaltıda karşına çıkacak.', 3000);
      if (W.ACX_DESTE_YENILE) W.ACX_DESTE_YENILE();
    };
  }
  function soyle(t, ms) {
    if (!balon || !t) return; metinEl.textContent = t; balon.classList.add('acik');
    clearTimeout(zaman); zaman = setTimeout(function () { balon.classList.remove('acik'); }, ms || 4500);
  }
  function tepki(c, sessiz) {
    if (!sessiz) { sesCal(c === 'sevin' ? 'dogru' : 'yanlis'); titre(c === 'sevin' ? 12 : [24, 50, 24]); }
    if (!ac) return; ac.classList.remove('sevin', 'uz'); void ac.offsetWidth; ac.classList.add(c); setTimeout(function () { ac.classList.remove(c); }, 1500);
  }

  /* ---------- ilerleme ---------- */
  function bitenler(panel) { return ls.al('bitti', {})[panel] || {}; }
  function bitir(panel, id) {
    var b = ls.al('bitti', {}); b[panel] = b[panel] || {}; var yeni = !b[panel][id]; b[panel][id] = Date.now(); ls.yaz('bitti', b);
    var g = ls.al('gunluk', {}), gun = gunAnahtar(new Date()); g[gun] = g[gun] || {}; g[gun][panel] = 1; ls.yaz('gunluk', g);   /* haftalık seri takvimi */
    var el = D.querySelector('.alis[data-id="' + id + '"]'); if (el) el.classList.add('bitti');
    if (el && yeni) odul(el);
    if (yeni) dans();   /* görev ilk kez bitince Acadia dans eder */
    var tamamOnce = D.querySelector('.rozet');
    sayac();
    if (yeni && !tamamOnce && D.querySelector('.rozet')) { soyle('Bu sayfa tamam. Defterine rozet yapıştırdım.', 5000); }
    return yeni;
  }
  function sayac() {
    var p = D.body.dataset.panel; if (!p) return;
    var tum = D.querySelectorAll('.alis[data-id]'), b = bitenler(p), n = 0;
    tum.forEach(function (el) { if (b[el.dataset.id]) { n++; el.classList.add('bitti'); } });
    D.querySelectorAll('[data-sayac]').forEach(function (el) { el.textContent = n + ' / ' + tum.length; });
    tum.forEach(function (el) { if (b[el.dataset.id] && !el.querySelector('.muhur')) muhur(el, b[el.dataset.id], false); });
    if (tum.length && n === tum.length) rozet();
  }

  /* ---------- çoktan seçmeli set ---------- */
  /* şıkları her turda karıştır (Doğru/Yanlış/Verilmemiş sırası sabit kalır) */
  function karistir(s) {
    if (s.sec.indexOf('Not Given') > -1 || s.sabit) return s;
    var sira = s.sec.map(function (_, k) { return k; }).sort(function () { return Math.random() - .5; });
    return Object.assign({}, s, { sec: sira.map(function (k) { return s.sec[k]; }), d: sira.indexOf(s.d) });
  }
  function test(el, sorular, o) {
    o = o || {}; var i = 0, dogru = 0, tur = sorular.map(karistir);
    function yeniTur(liste) { sorular = liste || sorular; tur = sorular.map(karistir); i = 0; dogru = 0; ciz(); }
    async function yeniSorular(btn) {
      btn.disabled = true; btn.textContent = 'Defne Hoca hazırlıyor…';
      var v = await icerik('test', o.panel + ':' + o.id);
      if (v && Array.isArray(v.sorular) && v.sorular.length) {
        var parca = el.closest('.alis') && el.closest('.alis').querySelector('.parca');
        if (v.parca && parca) parca.textContent = String(v.parca);
        yeniTur(v.sorular.map(function (q) { return { soru: temizHtml(q.soru), sec: q.sec.map(String), d: +q.d, neden: temizHtml(q.neden), dinle: q.dinle ? String(q.dinle) : '', ust: q.ust ? esc(q.ust) : '', yan: !!q.yan }; }));
        soyle('Yeni sorular geldi; bunları daha önce görmedin.', 3200);
      } else { soyle('Şu an yeni soru getiremedim; aynı soruları karıştırıp açtım.', 3600); yeniTur(); }
    }
    function ciz() {
      if (i >= tur.length) {
        el.innerHTML = '<p class="el" style="font-size:26px;margin:4px 0 8px;color:var(--c)">' + dogru + ' / ' + tur.length + (dogru === tur.length ? ' — tam isabet.' : dogru >= tur.length / 2 ? ' — fena değil, bir tur daha?' : ' — bir tur daha dönelim.') + '</p><div class="dugmeler" style="gap:8px">' + (o.panel && o.id && !o.yeniYok ? '<button class="btn sm ana" type="button" data-yeni>Yeni sorular</button>' : '') + '<button class="btn sm" type="button" data-bastan>Aynı sorular, karışık</button></div>';
        el.querySelector('[data-bastan]').onclick = function () { yeniTur(); };
        var yb = el.querySelector('[data-yeni]'); if (yb) yb.onclick = function () { yeniSorular(yb); };
        if (o.panel && dogru >= Math.ceil(tur.length * .6)) { bitir(o.panel, o.id); sevin(); soyle(o.tebrik || 'Bunu deftere işledim.', 4000); }
        return;
      }
      var s = tur[i]; el.dataset.dogru = s.d;   /* Acadia'nın "bir yanlışı ele" ipucu için */
      el.innerHTML = (s.ust ? '<div class="say" style="margin-bottom:8px">' + s.ust + '</div>' : '') + '<p style="margin:0 0 12px;font-size:18px">' + s.soru + '</p>' +
        (s.dinle ? '<p style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" type="button" data-dinle>▶ Dinle</button><button class="btn sm" type="button" data-yavas>Yavaş</button>' + (sesVar ? '' : '<span class="say">Tarayıcın sesli okumuyor: <i>' + esc(s.dinle) + '</i></span>') + '</p>' : '') +
        '<div class="sec' + (s.yan ? ' yan' : '') + '">' + s.sec.map(function (x, k) { return '<button type="button" data-k="' + k + '">' + esc(x) + '</button>'; }).join('') + '</div>' +
        '<div class="geri"></div><div class="alt-satir"><span class="say">' + (i + 1) + ' / ' + sorular.length + '</span><button class="btn sm ana" type="button" data-sonra hidden>Sonraki →</button></div>';
      if (s.dinle) { el.querySelector('[data-dinle]').onclick = function () { ses(s.dinle, s.hiz || .92); }; el.querySelector('[data-yavas]').onclick = function () { ses(s.dinle, .7); }; }
      el.querySelectorAll('.sec button').forEach(function (b) {
        b.onclick = function () {
          var k = +b.dataset.k, ok = k === s.d;
          el.querySelectorAll('.sec button').forEach(function (x) { x.disabled = true; if (+x.dataset.k === s.d) x.classList.add('dogru'); });
          if (!ok) b.classList.add('yanlis'); else dogru++;
          var g = el.querySelector('.geri'); g.innerHTML = '<span class="el">' + (ok ? 'Doğru. ' : 'Hmm, değil. ') + '</span>' + (s.neden || ''); g.classList.add('acik');
          (ok ? sevin : uz)();
          var sn = el.querySelector('[data-sonra]'); sn.hidden = false; sn.focus({ preventScroll: true });
          sn.onclick = function () { i++; ciz(); };
          delete el.dataset.dogru;
        };
      });
    }
    ciz();
  }

  /* ---------- ses ---------- */
  var sesVar = 'speechSynthesis' in W;
  function sesSec() { if (!sesVar) return null; var v = speechSynthesis.getVoices(); return v.find(function (x) { return /en-(GB|US)/.test(x.lang) && /Google|Natural|Samantha|Daniel/.test(x.name); }) || v.find(function (x) { return /^en/.test(x.lang); }) || null; }
  function ses(t, hiz, bitti) {
    if (!sesVar) { soyle('Tarayıcın sesli okumayı desteklemiyor; metni gösterdim.', 4000); if (bitti) bitti(); return; }
    speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(t); u.lang = 'en-GB'; var v = sesSec(); if (v) u.voice = v; u.rate = hiz || 1;
    u.onend = function () { if (bitti) bitti(); }; u.onboundary = function (e) { if (bitti && bitti.kelime) bitti.kelime(e.charIndex); };
    speechSynthesis.speak(u); return u;
  }
  if (sesVar) speechSynthesis.getVoices();


  /* ---------- gün ışığı: saate göre kâğıt tonu; 20:00–05:00 gece masası ---------- */
  var H = D.documentElement;
  function isikAd(saat) { return saat < 5 ? 'gece' : saat < 11 ? 'sabah' : saat < 17 ? 'ogle' : saat < 20 ? 'aksam' : 'gece'; }
  function isik() {
    var q = (location.search.match(/[?&]isik=(sabah|ogle|aksam|gece)/) || [])[1];
    H.dataset.isik = q || isikAd(new Date().getHours());
  }
  isik(); setInterval(isik, 5 * 60e3);

  /* ---------- ses ve titreşim: Web Audio ile üretilir, dosya yok; nav'daki düğmeyle kapanır ---------- */
  var sesAcik = ls.al('sesAcik', true), actx = null;
  function sesCal(tur) {
    if (!sesAcik) return;
    try {
      actx = actx || new (W.AudioContext || W.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      var t = actx.currentTime, cikis = actx.createGain(); cikis.gain.value = .22; cikis.connect(actx.destination);
      var ton = function (f1, f2, bas, sure, tip, hacim) {
        var o = actx.createOscillator(), g = actx.createGain(); o.type = tip || 'sine'; o.frequency.setValueAtTime(f1, t + bas); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + bas + sure);
        g.gain.setValueAtTime(0, t + bas); g.gain.linearRampToValueAtTime(hacim || .5, t + bas + .008); g.gain.exponentialRampToValueAtTime(.0008, t + bas + sure);
        o.connect(g); g.connect(cikis); o.start(t + bas); o.stop(t + bas + sure + .02);
      };
      var hisirti = function (bas, sure, f, hacim) {   /* kalem / kâğıt sürtünmesi */
        var n = Math.floor(actx.sampleRate * sure), buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
        var src = actx.createBufferSource(), fl = actx.createBiquadFilter(), g = actx.createGain(); src.buffer = buf; fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = .9; g.gain.value = hacim;
        src.connect(fl); fl.connect(g); g.connect(cikis); src.start(t + bas);
      };
      if (tur === 'dogru') { hisirti(0, .05, 3200, .5); ton(880, 0, .02, .16, 'sine', .35); ton(1320, 0, .09, .22, 'sine', .3); }
      else if (tur === 'yanlis') { ton(240, 150, 0, .2, 'triangle', .4); }
      else if (tur === 'bitti') { hisirti(0, .09, 700, .9); ton(523, 0, .06, .5, 'sine', .25); ton(659, 0, .12, .5, 'sine', .22); ton(784, 0, .18, .6, 'sine', .22); }
      else if (tur === 'sayfa') { hisirti(0, .28, 1800, .35); }
      else if (tur === 'kismen') { ton(660, 0, 0, .14, 'sine', .3); ton(587, 0, .1, .2, 'sine', .25); }
      else if (tur === 'tebesir') { hisirti(0, .07, 4200, .25); hisirti(.09, .05, 3800, .2); }
    } catch (e) { /* ses yok */ }
  }
  function titre(desen) { try { if (sesAcik && navigator.vibrate && W.matchMedia('(pointer:coarse)').matches) navigator.vibrate(desen); } catch (e) {} }
  function sesDugmesi() {
    var w = D.querySelector('.ust .wrap'); if (!w) return;
    var b = D.createElement('button'); b.type = 'button'; b.className = 'ses-d';
    var ciz = function () { b.setAttribute('aria-pressed', sesAcik); b.setAttribute('aria-label', sesAcik ? 'Sesi kapat' : 'Sesi aç'); b.title = sesAcik ? 'ses ve titreşim açık' : 'ses ve titreşim kapalı';
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9 h4 l5 -4 v14 l-5 -4 h-4 z" fill="currentColor"/>' + (sesAcik ? '<path d="M16 8.5 q2.5 3.5 0 7 M18.5 6 q4.5 6 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' : '<path d="M16 9 l6 6 M22 9 l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>') + '</svg>'; };
    b.onclick = function () { sesAcik = !sesAcik; ls.yaz('sesAcik', sesAcik); ciz(); if (sesAcik) sesCal('dogru'); };
    ciz(); w.appendChild(b);
  }

  /* ---------- ödül anları: mühür, kâğıt kırpıntısı, sayfa tamam rozeti ---------- */
  function tarihKisa(ts) { var d = new Date(ts); return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function muhur(el, ts, canli) {
    var m = D.createElement('span'); m.className = 'muhur' + (canli && !sakin ? ' bas' : ''); m.setAttribute('aria-hidden', 'true');
    m.innerHTML = '<b>tamam</b><small>' + tarihKisa(ts) + '</small>'; el.appendChild(m);
  }
  function odul(el) {
    muhur(el, Date.now(), true); sesCal('bitti'); titre([10, 30, 10, 30, 40]);
    if (sakin) return;
    var r = el.getBoundingClientRect(), renk = ['var(--writing)', 'var(--listening)', 'var(--reading)', 'var(--vocab)', 'var(--speaking)', 'var(--postit)', 'var(--postit2)'];
    for (var i = 0; i < 22; i++) {
      var k = D.createElement('i'); k.className = 'kirpinti';
      var x = r.left + r.width * (.55 + Math.random() * .4), y = Math.max(8, r.top + 20);
      k.style.cssText = 'left:' + x + 'px;top:' + y + 'px;background:' + renk[i % renk.length] + ';--dx:' + (Math.random() * 260 - 130) + 'px;--dy:' + (160 + Math.random() * 240) + 'px;--dr:' + (Math.random() * 720 - 360) + 'deg;width:' + (6 + Math.random() * 8) + 'px;height:' + (8 + Math.random() * 10) + 'px;animation-delay:' + (Math.random() * .12) + 's';
      D.body.appendChild(k); setTimeout(function (n) { return function () { n.remove(); }; }(k), 1700);
    }
  }
  function rozet() {
    var h = D.querySelector('#calis .bolum-b'); if (!h || h.querySelector('.rozet')) return;
    var r = D.createElement('span'); r.className = 'rozet'; r.innerHTML = '<b>sayfa<br>tamam</b>'; r.setAttribute('aria-label', 'Bu paneldeki dört alıştırma tamam'); h.appendChild(r);
  }

  /* ---------- katmanlı mekân: fare ve kaydırmayla derinlik ---------- */
  function parallax() {
    if (sakin) return;
    var sahne = D.querySelector('.kah [data-gir=dus]'); if (!sahne) return;
    var katman = [{ el: sahne, d: .5 }];
    sahne.querySelectorAll('.postit,.acadia-ciz,[data-derin]').forEach(function (el) { katman.push({ el: el, d: el.dataset.derin ? +el.dataset.derin : el.classList.contains('acadia-ciz') ? 2.2 : 1.4 }); });
    var mx = 0, my = 0, bekle = false, ince = W.matchMedia('(pointer:fine)').matches;
    var uygula = function () {
      bekle = false; var sy = Math.min(W.scrollY, 800);
      katman.forEach(function (k, i) { var ana = i === 0; k.el.style.translate = (mx * k.d * 9).toFixed(1) + 'px ' + (my * k.d * 7 + (ana ? sy * .12 : -sy * .05 * k.d)).toFixed(1) + 'px'; });
    };
    var iste = function () { if (!bekle) { bekle = true; requestAnimationFrame(uygula); } };
    if (ince) W.addEventListener('pointermove', function (e) { mx = e.clientX / W.innerWidth * 2 - 1; my = e.clientY / W.innerHeight * 2 - 1; iste(); }, { passive: true });
    W.addEventListener('scroll', iste, { passive: true });
  }
  function acadiaCiz() {
    var sahne = D.querySelector('.kah [data-gir=dus]'); if (!sahne || D.body.dataset.sayfa === 'hub') return;
    var a = D.createElement('div'); a.className = 'acadia-ciz'; a.innerHTML = acadiaSvg(D.body.dataset.panel); sahne.appendChild(a);
  }

  /* ---------- kenar karalamaları ve yırtık kâğıt ---------- */
  var KARALAMA = [
    '<path pathLength="1" d="M10 70 C 30 20, 70 10, 90 40 S 100 90, 70 80 M62 70 l8 10 l12 -4"/>',
    '<path pathLength="1" d="M50 8 L60 40 L94 40 L66 60 L76 92 L50 72 L24 92 L34 60 L6 40 L40 40 Z"/>',
    '<path pathLength="1" d="M50 50 m0 -4 a4 4 0 1 1 -4 4 a10 10 0 1 1 10 10 a18 18 0 1 1 -18 -18 a26 26 0 1 1 26 26"/>',
    '<path pathLength="1" d="M8 60 q14 -30 28 0 t28 0 t28 0 M20 82 q40 -12 70 0"/>',
    '<path pathLength="1" d="M20 20 l60 60 M80 20 l-60 60 M50 6 v88"/>'
  ];
  function karalamalar() {
    D.querySelectorAll('.bolum-b h2').forEach(function (h) {
      if (h.querySelector('.alt-ciz')) return;
      var s = D.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 200 12'); s.setAttribute('preserveAspectRatio', 'none'); s.setAttribute('class', 'alt-ciz ciz'); s.setAttribute('aria-hidden', 'true'); s.dataset.gir = 'yukari';
      s.innerHTML = '<path pathLength="1" d="M3 8 C 50 3, 120 11, 197 5"/>'; h.appendChild(s);
    });
    D.querySelectorAll('.bolum .wrap, .sonraki .wrap').forEach(function (w, i) {
      var k = D.createElement('div'); k.className = 'karalama ' + (i % 2 ? 'sag' : 'sol'); k.setAttribute('aria-hidden', 'true');
      k.innerHTML = '<svg class="ciz" data-gir="bant" viewBox="0 0 100 100">' + KARALAMA[i % KARALAMA.length] + '</svg>';
      w.style.position = 'relative'; w.appendChild(k);
    });
    var c = D.getElementById('calis') || D.querySelector('[data-yirtik]'); if (c) c.classList.add('yirtik');
  }

  /* ---------- hub: kapak açılışı, şimdiki durak, haftalık seri ---------- */
  var PANEL = [
    { id: 'vocab', ad: 'Vocab', yer: 'kahvaltı', saat: '07:40' },
    { id: 'listening', ad: 'Listening', yer: 'otobüs', saat: '08:15' },
    { id: 'reading', ad: 'Reading', yer: 'kütüphane', saat: '10:00' },
    { id: 'speaking', ad: 'Speaking', yer: 'kafe', saat: '17:00' },
    { id: 'writing', ad: 'Writing', yer: 'yurt odası', saat: '21:40' }
  ];
  function gunAnahtar(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function gunluk() {   /* eski kayıtlar: bitti zaman damgalarından da türet */
    var g = JSON.parse(JSON.stringify(ls.al('gunluk', {}))), b = ls.al('bitti', {});
    Object.keys(b).forEach(function (p) { Object.keys(b[p]).forEach(function (id) { var k = gunAnahtar(new Date(b[p][id])); g[k] = g[k] || {}; g[k][p] = 1; }); });
    return g;
  }
  function kapak() {
    var yer = D.body.dataset.sayfa === 'hub'; if (!yer || sakin) return;
    var once = ls.al('kapakGordu', 0), sure = once ? 650 : 1500, adx = W.ACX_AD || (function () { try { return sessionStorage.getItem('acx.ad') || ''; } catch (e) { return ''; } })(), ad = adx ? ', ' + adx : '';
    var o = D.createElement('div'); o.className = 'kapak-ac' + (once ? ' kisa' : ''); o.style.setProperty('--sure', sure + 'ms'); o.setAttribute('aria-hidden', 'true');
    o.innerHTML = '<div class="ic"><span class="el">' + gunTr(new Date()) + '</span><b>Defterin hazır' + esc(ad) + '.</b></div><div class="on"><div class="etk"><small>dönem defteri</small><b>English</b><span class="el">Acadex</span></div><span class="lastik"></span></div>';
    D.body.appendChild(o); ls.yaz('kapakGordu', 1); sesCal('sayfa');
    var kapat = function () { o.classList.add('bitti'); setTimeout(function () { o.remove(); }, 450); };
    o.addEventListener('click', kapat); setTimeout(kapat, sure + (once ? 150 : 700));
  }
  var GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'], AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  function gunTr(d) { return d.getDate() + ' ' + AYLAR[d.getMonth()] + ', ' + GUNLER[d.getDay()]; }
  function simdi() {
    var el = D.getElementById('simdi'); if (!el) return;
    var d = new Date(), dk = d.getHours() * 60 + d.getMinutes(), saat = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    var dilim = dk < 300 ? { p: 0, m: 'Gece yarısını geçti. Uyumadan önce beş dakikalık bir deste?' } : dk < 510 ? { p: 0, m: 'Kahvaltı saati. Çay demlenene kadar on kart.' } : dk < 600 ? { p: 1, m: 'Yoldaysan kulaklığı tak: dört kısa dinleme.' } : dk < 840 ? { p: 2, m: 'Kütüphane saati. Bir makale, iki okuma.' } : dk < 1140 ? { p: 3, m: 'Kafe saati. İki dakika konuş, kendini dinle.' } : { p: 4, m: 'Akşam oldu. Bir paragraf, kırmızı kalem açıklamalı.' };
    var i = dilim.p, tam = function (k) { return Object.keys(bitenler(PANEL[k].id)).length >= 4; }, n = 0;
    while (tam(i) && n < 5) { i = (i + 1) % 5; n++; }
    var p = PANEL[i], mesaj = n === 5 ? 'Beş panelin hepsi tamam. Deste yine de her gün yenileniyor.' : i !== dilim.p ? 'Bu saatin paneli zaten bitti. Sıradaki durak:' : dilim.m;
    el.innerHTML = '<span class="mono">şu an ' + saat + '</span><p class="el">' + esc(mesaj) + '</p><a class="btn sm ana" href="' + p.id + '.html">' + p.ad + ' · ' + p.yer + ' →</a>';
  }
  function hafta() {
    var el = D.getElementById('hafta'); if (!el) return;
    var g = gunluk(), bugun = new Date(); bugun.setHours(0, 0, 0, 0);
    var pzt = new Date(bugun); pzt.setDate(bugun.getDate() - ((bugun.getDay() + 6) % 7));
    var RENK = { vocab: 'var(--vocab)', listening: 'var(--listening)', reading: 'var(--reading)', speaking: 'var(--speaking)', writing: 'var(--writing)' };
    var hucre = '';
    for (var i = 0; i < 7; i++) {
      var d = new Date(pzt); d.setDate(pzt.getDate() + i); var k = gunAnahtar(d), pan = Object.keys(g[k] || {}), gelecek = d > bugun;
      hucre += '<div class="gun' + (+d === +bugun ? ' bugun' : '') + (gelecek ? ' gelecek' : '') + '"><small>' + GUNLER[d.getDay()].slice(0, 3) + '</small><b>' + d.getDate() + '</b><span class="lekeler">' +
        pan.map(function (p, j) { return '<i class="leke" style="--lc:' + RENK[p] + ';--lr:' + (j * 67 % 360) + 'deg;--ld:' + (i * .06 + j * .1) + 's" title="' + p + '"></i>'; }).join('') + '</span></div>';
    }
    var seri = 0, c = new Date(bugun); if (!g[gunAnahtar(c)]) c.setDate(c.getDate() - 1);
    while (g[gunAnahtar(c)]) { seri++; c.setDate(c.getDate() - 1); }
    var tk = el.querySelector('.takvim'); if (tk) tk.innerHTML = hucre;   /* hub'da yatay şerit hub.js'te */
    el.querySelector('[data-seri]').textContent = seri ? seri + ' günlük seri' : 'seri bugün başlıyor';
  }

  /* kapı açıldığında (assets/kapi.js 'acx:acik') hub'ın kapağı oynar */
  function kapiSonra(fn) { if (!H.classList.contains('kapi')) fn(); else D.addEventListener('acx:acik', fn, { once: true }); }


  /* ---------- yapay zekâ ve içerik havuzu (supabase/functions/ingilizce-hoca) ---------- */
  var yzKapali = false;
  async function yz(mod, veri, ms) {
    if (yzKapali) return null;
    var url, anahtar, sb;
    try { url = SUPABASE_URL; anahtar = SUPABASE_ANON_KEY; sb = supabaseClient; } catch (e) { return null; }
    try {
      var s = await sb.auth.getSession(), tok = s && s.data && s.data.session && s.data.session.access_token; if (!tok) return null;
      var ac = new AbortController(), zaman = setTimeout(function () { ac.abort(); }, ms || 9000);
      var r = await fetch(url + '/functions/v1/ingilizce-hoca', { method: 'POST', signal: ac.signal, headers: { Authorization: 'Bearer ' + tok, apikey: anahtar, 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ mod: mod }, veri)) });
      clearTimeout(zaman);
      if (r.status === 404) { yzKapali = true; return null; }   /* fonksiyon yayında değil: bu oturumda bir daha denenmez */
      if (!r.ok) return null;
      var j = await r.json(); return j && typeof j === 'object' && !j.error ? j : null;
    } catch (e) { return null; }
  }
  /* havuzdan görülmemiş içerik; yoksa fonksiyon üretir (okuma metni 20 sn'yi bulabilir) */
  async function icerik(tur, alt) { var j = await yz('icerik', { tur: tur, alt: alt || '' }, 30000); return j && j.veri && typeof j.veri === 'object' ? j.veri : null; }
  /* yapay zekâ metninde yalnız <b>, <i>, <u> kalır */
  function temizHtml(t) { return esc(t).replace(/&lt;(\/?)(b|i|u)&gt;/g, '<$1$2>'); }

  /* ---------- her panelin kendi dünyası: kenarlarda hep canlı, sakin; yazarken kısılır ---------- */
  var DUNYA = {
    vocab: {
      sol: '<svg viewBox="0 0 160 260"><g class="buharlar"><path class="buh b1" d="M70 96 c-10 -16 10 -24 0 -42"/><path class="buh b2" d="M86 96 c-10 -16 10 -24 0 -42"/></g><path d="M58 104 h40 c-2 10 -8 16 -8 28 c0 12 6 18 8 30 h-40 c2 -12 8 -18 8 -30 c0 -12 -6 -18 -8 -28z" fill="#C2462F" fill-opacity=".75" stroke="#1A2A5C" stroke-width="3" stroke-linejoin="round"/><ellipse cx="78" cy="168" rx="34" ry="7" fill="#F5EFE2" stroke="#1A2A5C" stroke-width="3"/><ellipse cx="80" cy="222" rx="54" ry="16" fill="#F5EFE2" stroke="#1A2A5C" stroke-width="3"/><ellipse cx="80" cy="214" rx="34" ry="12" fill="none" stroke="#C98B3A" stroke-width="10"/><g fill="#1A2A5C"><circle cx="64" cy="209" r="1.5"/><circle cx="90" cy="206" r="1.5"/><circle cx="98" cy="218" r="1.5"/><circle cx="70" cy="222" r="1.5"/></g></svg>',
      sag: '<svg viewBox="0 0 160 260"><rect x="20" y="20" width="120" height="150" rx="6" fill="#BFE0EA" stroke="#1A2A5C" stroke-width="3"/><circle class="gunes2" cx="104" cy="58" r="16" fill="#FFD86B" stroke="#1A2A5C" stroke-width="2.5"/><path d="M80 20 v150 M20 95 h120" stroke="#1A2A5C" stroke-width="3"/><path class="perde" d="M14 14 h40 c-6 40 6 90 -4 160 h-36z" fill="#F4A487" stroke="#1A2A5C" stroke-width="3" stroke-linejoin="round"/></svg>',
      ucan: ['apple', 'bread', 'tea', 'honey', 'olive', 'egg', 'cheese', 'jam']
    },
    listening: {
      sol: '<svg viewBox="0 0 160 260"><defs><clipPath id="dy-cam"><rect x="12" y="40" width="136" height="150" rx="22"/></clipPath></defs><rect x="12" y="40" width="136" height="150" rx="22" fill="#A9D3F0" stroke="#1A2A5C" stroke-width="4"/><g clip-path="url(#dy-cam)"><g class="sehir s1"><path d="M0 190 V130 h20 V110 h18 V140 h16 V96 h22 V128 h18 V118 h20 V150 h16 V104 h24 V136 h20 V122 h22 V140 h18 V112 h22 V190z M320 190 V130 h20 V110 h18 V140 h16 V96 h22 V128 h18 V118 h20 V150 h16 V104 h24 V136 h20 V122 h22 V140 h18 V112 h22 V190z" fill="#7FA7D9" stroke="#1A2A5C" stroke-width="2"/></g><g class="sehir s2"><path d="M0 190 V160 h30 V150 h40 V166 h30 V156 h40 V170 h20 V162 h40 V190z M200 190 V160 h30 V150 h40 V166 h30 V156 h40 V170 h20 V162 h40 V190z" fill="#4E7FB8" stroke="#1A2A5C" stroke-width="2"/></g></g><rect x="12" y="40" width="136" height="150" rx="22" fill="none" stroke="#1A2A5C" stroke-width="10" stroke-opacity=".9"/></svg>',
      sag: '<svg viewBox="0 0 160 260"><path d="M10 10 H150" stroke="#8A93AE" stroke-width="6" stroke-linecap="round"/><g class="tutamak"><path d="M80 12 V70" stroke="#1A2A5C" stroke-width="3"/><path d="M80 70 c-16 0 -22 24 0 30 c22 -6 16 -30 0 -30z" fill="#FFD86B" stroke="#1A2A5C" stroke-width="3"/></g><g class="nota"><text x="34" y="190">♪</text><text x="104" y="220">♫</text><text x="64" y="240">♪</text></g></svg>'
    },
    reading: {
      sol: '<svg viewBox="0 0 160 300"><rect x="10" y="10" width="140" height="280" fill="#8A5A3B" stroke="#1A2A5C" stroke-width="3"/>' + [0, 1, 2, 3].map(function (r) { var y = 20 + r * 68, x = 18, h = ''; ['#C93B2B', '#2D5BD3', '#2C7A4B', '#E3A80F', '#8A5CC2', '#DD5A36', '#0F8582', '#F5EFE2'].forEach(function (c, i) { var w = 10 + (i * 7 + r * 5) % 9; if (x + w > 142) return; h += '<rect x="' + x + '" y="' + (y + (i % 3) * 3) + '" width="' + w + '" height="' + (56 - (i % 3) * 3) + '" fill="' + c + '" stroke="#1A2A5C" stroke-width="1.5"/>'; x += w + 2; }); return h + '<rect x="14" y="' + (y + 56) + '" width="132" height="6" fill="#5E3A24"/>'; }).join('') + '</svg>',
      sag: '<svg viewBox="0 0 160 260"><path class="isin" d="M150 0 L60 260 L160 260z" fill="#FFE9A8" fill-opacity=".35"/><g class="toz2"><circle cx="110" cy="80" r="2"/><circle cx="130" cy="140" r="1.6"/><circle cx="96" cy="180" r="2.2"/><circle cx="140" cy="60" r="1.4"/><circle cx="118" cy="220" r="1.8"/></g><g transform="translate(80 210)"><path d="M-46 0 L0 10 L46 0 V-30 L0 -20 L-46 -30z" fill="#F5EFE2" stroke="#1A2A5C" stroke-width="3" stroke-linejoin="round"/><path class="sayfa2" d="M0 -20 L44 -30 V0 L0 10z" fill="#FFFDF8" stroke="#1A2A5C" stroke-width="2.5" stroke-linejoin="round"/></g></svg>'
    },
    speaking: {
      sol: '<svg viewBox="0 0 160 260"><g class="buharlar"><path class="buh b1" d="M66 120 c-10 -16 10 -24 0 -42"/><path class="buh b2" d="M84 120 c-10 -16 10 -24 0 -42"/></g><path d="M44 128 h64 v40 a32 32 0 0 1 -64 0z" fill="#F5EFE2" stroke="#1A2A5C" stroke-width="3.5" stroke-linejoin="round"/><path d="M108 138 a14 14 0 0 1 0 28" fill="none" stroke="#1A2A5C" stroke-width="3.5"/><ellipse cx="76" cy="208" rx="54" ry="10" fill="#F5EFE2" stroke="#1A2A5C" stroke-width="3"/><path d="M50 128 h52" stroke="#7A4A2A" stroke-width="5"/></svg>',
      sag: '<svg viewBox="0 0 160 260"><g class="bitki"><path d="M80 230 C78 180 82 150 80 110" stroke="#2C7A4B" stroke-width="4" fill="none"/><path class="yap y1" d="M80 160 c-30 -6 -44 -30 -40 -46 c22 4 40 22 40 46z" fill="#4E9A5B" stroke="#1A2A5C" stroke-width="2.5"/><path class="yap y2" d="M80 140 c30 -6 44 -30 40 -46 c-22 4 -40 22 -40 46z" fill="#4E9A5B" stroke="#1A2A5C" stroke-width="2.5"/><path class="yap y3" d="M80 112 c-18 -10 -22 -32 -14 -44 c14 10 18 26 14 44z" fill="#3E8A4B" stroke="#1A2A5C" stroke-width="2.5"/></g><path d="M50 228 h60 l-8 28 h-44z" fill="#DD5A36" stroke="#1A2A5C" stroke-width="3" stroke-linejoin="round"/></svg>',
      balon: ['hi!', 'really?', 'no way!', 'cool', 'cheers', 'I agree', 'well…', 'nice!']
    },
    writing: {
      sol: '<svg viewBox="0 0 160 260"><circle class="lamba-isik" cx="96" cy="130" r="60" fill="#FFE9A8" fill-opacity=".5"/><path d="M40 240 h80 M80 240 V170 L110 120" stroke="#1A2A5C" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M90 96 l44 20 l-16 26 l-40 -22z" fill="#2D5BD3" stroke="#1A2A5C" stroke-width="3" stroke-linejoin="round"/><rect x="34" y="236" width="92" height="10" rx="3" fill="#8A5A3B" stroke="#1A2A5C" stroke-width="2.5"/></svg>',
      sag: '<svg viewBox="0 0 160 260"><rect x="20" y="20" width="120" height="160" rx="6" fill="#22356E" stroke="#1A2A5C" stroke-width="3"/><circle cx="104" cy="60" r="16" fill="#F5EFE2"/><circle cx="112" cy="54" r="14" fill="#22356E"/><g class="yildiz"><circle cx="44" cy="46" r="2"/><circle cx="70" cy="90" r="1.6"/><circle cx="120" cy="120" r="2"/><circle cx="50" cy="140" r="1.5"/><circle cx="90" cy="34" r="1.4"/></g><path d="M80 20 v160 M20 100 h120" stroke="#1A2A5C" stroke-width="3"/></svg>',
      ucak: true
    }
  };
  var dunya = null;
  function dunyaKur() {
    var p = D.body.dataset.panel, d = DUNYA[p]; if (!d) return;
    dunya = D.createElement('div'); dunya.className = 'dunya dunya-' + p; dunya.setAttribute('aria-hidden', 'true');
    dunya.innerHTML = '<div class="dy-sol">' + d.sol + '</div><div class="dy-sag">' + d.sag + '</div>' + (d.ucak ? '<svg class="dy-ucak" viewBox="0 0 60 30"><path d="M2 14 L58 2 L22 20 Z M22 20 L30 28 L36 12" fill="#fff" stroke="#1A2A5C" stroke-width="2.5" stroke-linejoin="round"/></svg>' : '');
    D.body.insertBefore(dunya, D.body.firstChild); D.body.classList.add('dunyali');
    if (sakin) return;
    /* yazarken, sınavda ve sekme gizliyken kısılır */
    D.addEventListener('focusin', function (e) { if (e.target.matches && e.target.matches('input,textarea,select')) dunya.classList.add('kis'); });
    D.addEventListener('focusout', function () { setTimeout(function () { var a = D.activeElement; if (!(a && a.matches && a.matches('input,textarea,select'))) dunya.classList.remove('kis'); }, 50); });
    D.addEventListener('visibilitychange', function () { dunya.classList.toggle('dur', D.hidden); });
    var kelime = d.ucan || d.balon; if (!kelime) return;
    var i = 0;
    setInterval(function () {
      if (D.hidden || dunya.classList.contains('kis') || D.body.classList.contains('sinavda')) return;
      var b = D.createElement('span'); b.className = d.balon ? 'dy-balon' : 'dy-harf';
      b.textContent = kelime[i++ % kelime.length]; b.style.setProperty('--x', (i % 2 ? 4 + (i * 13) % 8 : 88 - (i * 11) % 8) + '%');
      dunya.appendChild(b); setTimeout(function () { b.remove(); }, 7000);
    }, 4200);
  }

  /* ---------- Acadia arkadaş: gözleriyle izler, uzun durunca uyuklar, başarıda dans eder ---------- */
  var sonHareket = Date.now();
  function bakis(x, y) {
    if (!ac) return; var r = ac.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height * .45, dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1, k = Math.min(1, l / 220) * 2.4;
    ac.style.setProperty('--gx', (dx / l * k * (ac.classList.contains('ters') ? -1 : 1)).toFixed(2) + 'px'); ac.style.setProperty('--gy', (dy / l * k).toFixed(2) + 'px');
  }
  function uyan() {
    sonHareket = Date.now();
    if (ac && ac.classList.contains('uyku')) { ac.classList.remove('uyku'); ac.classList.remove('uyandi'); void ac.offsetWidth; ac.classList.add('uyandi'); setTimeout(function () { ac.classList.remove('uyandi'); }, 900); }
  }
  function arkadasKur() {
    if (!ac || sakin) return;
    var bekle = false, sx = 0, sy = 0;
    if (W.matchMedia('(pointer:fine)').matches) W.addEventListener('pointermove', function (e) { sx = e.clientX; sy = e.clientY; uyan(); if (!bekle) { bekle = true; requestAnimationFrame(function () { bekle = false; bakis(sx, sy); }); } }, { passive: true });
    D.addEventListener('pointerdown', function (e) { bakis(e.clientX, e.clientY); uyan(); }, { passive: true });
    D.addEventListener('keydown', uyan); W.addEventListener('scroll', function () { uyan(); bakis(W.innerWidth * .45, W.innerHeight * .45); }, { passive: true });
    D.addEventListener('focusin', function (e) { var r = e.target.getBoundingClientRect && e.target.getBoundingClientRect(); if (r && r.width) bakis(r.left + r.width / 2, r.top + r.height / 2); });
    setInterval(function () { if (Date.now() - sonHareket > 45000 && !ac.classList.contains('mesgul') && !ac.classList.contains('uyku')) ac.classList.add('uyku'); }, 5000);
  }
  function dans() { if (!ac || sakin) return; ac.classList.remove('dans'); void ac.offsetWidth; ac.classList.add('dans'); setTimeout(function () { ac.classList.remove('dans'); }, 1800); }

  W.ACX = { esc: esc, ls: ls, sakin: sakin, girisler: girisler, soyle: soyle, sevin: function () { tepki('sevin'); }, uz: function () { tepki('uz'); }, test: test, bitir: bitir, bitenler: bitenler, sayac: sayac, ses: ses, sesVar: sesVar, acadiaSvg: acadiaSvg, sesCal: sesCal, gunluk: gunluk, sesAcik: function () { return sesAcik; }, odul: odul, yz: yz, icerik: icerik, temizHtml: temizHtml, sozlukEkle: sozlukEkle, kelimeAc: kelimeAc, gunlukEkle: function (panel) { var g = ls.al('gunluk', {}), k = gunAnahtar(new Date()); g[k] = g[k] || {}; g[k][panel] = 1; ls.yaz('gunluk', g); } };
  function sevin() { tepki('sevin'); } function uz() { tepki('uz'); }

  function basla() { sesDugmesi(); acadiaCiz(); karalamalar(); girisler(); sahneKur(); dunyaKur(); acadiaKur(); arkadasKur(); sayac(); parallax(); simdi(); hafta(); kapiSonra(kapak); }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', basla); else basla();
})();
