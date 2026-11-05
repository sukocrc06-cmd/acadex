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
      '<g class="kirp" style="transform-origin:0 -4px"><ellipse cx="-10" cy="-4" rx="6.5" ry="8" fill="#fff" stroke="' + INK + '" stroke-width="2.5"/><circle cx="-9" cy="-3" r="3.6" fill="' + INK + '"/><ellipse cx="10" cy="-4" rx="6.5" ry="8" fill="#fff" stroke="' + INK + '" stroke-width="2.5"/><circle cx="11" cy="-3" r="3.6" fill="' + INK + '"/></g>' +
      '<path d="M-6 10 Q0 16 6 10" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>' + (KOSTUM[kos] || '') + '</g></svg>';
  }
  var ACADIA = '';
  var ac, balon, metinEl, zaman, sozler = [];
  function acadiaKur() {
    ac = D.createElement('div'); ac.className = 'acadia';
    ac.innerHTML = '<div class="balon" role="status" aria-live="polite"><span></span><button type="button" aria-label="Kapat">×</button></div><button type="button" aria-label="Acadia: ipucu">' + acadiaSvg(D.body.dataset.panel || 'hub') + '</button>';
    D.body.appendChild(ac); balon = ac.querySelector('.balon'); metinEl = balon.querySelector('span');
    balon.querySelector('button').onclick = function () { balon.classList.remove('acik'); };
    ac.querySelector('button[aria-label^=Acadia]').onclick = function () {
      var ip = D.body.dataset.ipucu ? D.body.dataset.ipucu.split('|') : ['Merhaba!'];
      soyle(ip[Math.floor(Math.random() * ip.length)], 6000); tepki('sevin', true);
    };
    /* bölüme girince bir kez konuşur */
    var g = 'IntersectionObserver' in W ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { soyle(e.target.dataset.acadia, 5200); g.unobserve(e.target); } });
    }, { threshold: .35 }) : null;
    D.querySelectorAll('[data-acadia]').forEach(function (el) { if (g) g.observe(el); });
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
  function test(el, sorular, o) {
    o = o || {}; var i = 0, dogru = 0;
    function ciz() {
      if (i >= sorular.length) {
        el.innerHTML = '<p class="el" style="font-size:26px;margin:4px 0 8px;color:var(--c)">' + dogru + ' / ' + sorular.length + (dogru === sorular.length ? ' — tam isabet.' : dogru >= sorular.length / 2 ? ' — fena değil, bir tur daha?' : ' — bir tur daha dönelim.') + '</p><button class="btn sm" type="button">Baştan</button>';
        el.querySelector('button').onclick = function () { i = 0; dogru = 0; ciz(); };
        if (o.panel && dogru >= Math.ceil(sorular.length * .6)) { bitir(o.panel, o.id); sevin(); soyle(o.tebrik || 'Bunu deftere işledim.', 4000); }
        return;
      }
      var s = sorular[i];
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
    el.querySelector('.takvim').innerHTML = hucre;
    el.querySelector('[data-seri]').textContent = seri ? seri + ' günlük seri' : 'seri bugün başlıyor';
  }

  /* kapı açıldığında (assets/kapi.js 'acx:acik') hub'ın kapağı oynar */
  function kapiSonra(fn) { if (!H.classList.contains('kapi')) fn(); else D.addEventListener('acx:acik', fn, { once: true }); }

  W.ACX = { esc: esc, ls: ls, sakin: sakin, girisler: girisler, soyle: soyle, sevin: function () { tepki('sevin'); }, uz: function () { tepki('uz'); }, test: test, bitir: bitir, bitenler: bitenler, sayac: sayac, ses: ses, sesVar: sesVar, acadiaSvg: acadiaSvg, sesCal: sesCal, gunluk: gunluk, sesAcik: function () { return sesAcik; }, odul: odul, gunlukEkle: function (panel) { var g = ls.al('gunluk', {}), k = gunAnahtar(new Date()); g[k] = g[k] || {}; g[k][panel] = 1; ls.yaz('gunluk', g); } };
  function sevin() { tepki('sevin'); } function uz() { tepki('uz'); }

  function basla() { sesDugmesi(); acadiaCiz(); karalamalar(); girisler(); sahneKur(); acadiaKur(); sayac(); parallax(); simdi(); hafta(); kapiSonra(kapak); }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', basla); else basla();
})();
