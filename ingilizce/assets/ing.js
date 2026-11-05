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

  /* ---------- Acadia ---------- */
  var ACADIA = '<svg viewBox="-62 -62 124 124" aria-hidden="true"><g class="gov"><path d="M0 -52 C7 -19 19 -7 52 0 C19 7 7 19 0 52 C-7 19 -19 7 -52 0 C-19 -7 -7 -19 0 -52 Z" fill="#FFD86B" stroke="#1A2A5C" stroke-width="4" stroke-linejoin="round"/>' +
    '<ellipse cx="-17" cy="11" rx="6" ry="3.5" fill="#F29C94"/><ellipse cx="17" cy="11" rx="6" ry="3.5" fill="#F29C94"/>' +
    '<g class="kirp" style="transform-origin:0 -4px"><ellipse cx="-10" cy="-4" rx="6.5" ry="8" fill="#fff" stroke="#1A2A5C" stroke-width="2.5"/><circle cx="-9" cy="-3" r="3.6" fill="#1A2A5C"/><ellipse cx="10" cy="-4" rx="6.5" ry="8" fill="#fff" stroke="#1A2A5C" stroke-width="2.5"/><circle cx="11" cy="-3" r="3.6" fill="#1A2A5C"/></g>' +
    '<path d="M-6 10 Q0 16 6 10" fill="none" stroke="#1A2A5C" stroke-width="3" stroke-linecap="round"/></g></svg>';
  var ac, balon, metinEl, zaman, sozler = [];
  function acadiaKur() {
    ac = D.createElement('div'); ac.className = 'acadia';
    ac.innerHTML = '<div class="balon" role="status" aria-live="polite"><span></span><button type="button" aria-label="Kapat">×</button></div><button type="button" aria-label="Acadia: ipucu">' + ACADIA + '</button>';
    D.body.appendChild(ac); balon = ac.querySelector('.balon'); metinEl = balon.querySelector('span');
    balon.querySelector('button').onclick = function () { balon.classList.remove('acik'); };
    ac.querySelector('button[aria-label^=Acadia]').onclick = function () {
      var ip = D.body.dataset.ipucu ? D.body.dataset.ipucu.split('|') : ['Merhaba!'];
      soyle(ip[Math.floor(Math.random() * ip.length)], 6000); sevin();
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
  function tepki(c) { if (!ac) return; ac.classList.remove('sevin', 'uz'); void ac.offsetWidth; ac.classList.add(c); setTimeout(function () { ac.classList.remove(c); }, 1500); }

  /* ---------- ilerleme ---------- */
  function bitenler(panel) { return ls.al('bitti', {})[panel] || {}; }
  function bitir(panel, id) {
    var b = ls.al('bitti', {}); b[panel] = b[panel] || {}; var yeni = !b[panel][id]; b[panel][id] = Date.now(); ls.yaz('bitti', b);
    var el = D.querySelector('.alis[data-id="' + id + '"]'); if (el) el.classList.add('bitti');
    sayac(); return yeni;
  }
  function sayac() {
    var p = D.body.dataset.panel; if (!p) return;
    var tum = D.querySelectorAll('.alis[data-id]'), b = bitenler(p), n = 0;
    tum.forEach(function (el) { if (b[el.dataset.id]) { n++; el.classList.add('bitti'); } });
    D.querySelectorAll('[data-sayac]').forEach(function (el) { el.textContent = n + ' / ' + tum.length; });
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

  W.ACX = { esc: esc, ls: ls, sakin: sakin, girisler: girisler, soyle: soyle, sevin: function () { tepki('sevin'); }, uz: function () { tepki('uz'); }, test: test, bitir: bitir, bitenler: bitenler, sayac: sayac, ses: ses, sesVar: sesVar };
  function sevin() { tepki('sevin'); } function uz() { tepki('uz'); }

  function basla() { girisler(); sahneKur(); acadiaKur(); sayac(); }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', basla); else basla();
})();
