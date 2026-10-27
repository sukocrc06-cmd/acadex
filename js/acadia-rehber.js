/* ==========================================================================
   ACADIA REHBER (js/acadia-rehber.js), 28.10.2026 — landing'de anlatıcı eşlikçi
   Acadia sayfanın sağında durur; scroll'la bölümden bölüme süzülür, her durakta
   poz/ifade değiştirir ve kısa bir balonla bölümü anlatır. Hızlı scroll'da hafifçe
   yatar, tıklayınca zıplar ve bir sonraki cümleyi söyler. Gözleri imleci izler.
   Telefonda sağ altta, küçük ve balonu kısa süreli. Hareket azaltmada sabit durur,
   yalnız ifade ve balon değişir. Çizim: js/acadia-kit.js.
   ========================================================================== */
(function () {
  'use strict';
  var K = window.AcadiaKit; if (!K || !window.IntersectionObserver) return;
  var D = document, W = window;
  var calm = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var STOPS = [
    { q: '[data-hero]', pose: 'selam', mood: 'mutlu', y: 34, t: 'Merhaba, ben Acadia! Notlarını birlikte sınava hazırlayalım.' },
    { q: '[data-mfs]', pose: 'isaret', mood: 'kirp', y: 46, t: 'Hangi ders olursa olsun: okumayı kısaltmam, anlamayı hızlandırırım.' },
    { q: '#nasil', pose: 'oku', mood: 'odakli', y: 40, t: 'Yükle, özetle, çalış, ölç. Dört adımın hepsinde yanındayım.' },
    { q: '#alanlar', pose: 'dusun', mood: 'dusunuyor', y: 52, t: 'Ezberden değil, anlamaktan yanayım.' },
    { q: '#yontemler', pose: 'isaret', mood: 'mutlu', y: 38, t: 'Pomodoro, aralıklı tekrar, Feynman… hepsi tek masada.' },
    { q: '#akis', pose: 'dur', mood: 'odakli', y: 48, t: 'Her derse ona uyan tekniği öneririm.' },
    { q: '#dene', pose: 'zipla', mood: 'saskin', y: 40, t: 'Kayıt bile gerekmez, üç kart çöz bakalım!' },
    { q: '#gizlilik', pose: 'dur', mood: 'odakli', y: 46, t: 'Notların sende kalır; kimseye göstermem.' },
    { q: '#soru', pose: 'dusun', mood: 'dusunuyor', y: 42, t: 'Aklına takılan bir şey mi var? Sor, cevaplayalım.' },
    { q: '#kayit', pose: 'zipla', mood: 'kutlama', y: 38, t: 'Hazırsan başlayalım!' }
  ];
  var EXTRA = ['Bir daha dürtersen gıdıklanırım.', 'Sınav haftası gelmeden başlayan kazanır.', 'Kartlarını ben sıralarım, sen sadece çevir.', 'Yıldız değilim ama sınavda parlatırım.'];

  var g = D.createElement('div'); g.className = 'acd-guide'; g.setAttribute('aria-hidden', 'true');
  var host = D.createElement('span'); host.className = 'acd-gh say-l'; host.setAttribute('data-acadia', ''); host.dataset.mood = 'mutlu'; host.dataset.pose = 'selam'; host.dataset.size = '150';
  var live = D.createElement('p'); live.className = 'acd-live'; live.setAttribute('aria-live', 'polite');
  g.appendChild(host); D.body.appendChild(g); D.body.appendChild(live);
  K.mount();

  var cur = -1, extraI = 0, hideT = 0, narrow = function () { return W.innerWidth < 900; };
  var go = function (i) {
    if (i === cur || !STOPS[i]) return; cur = i; var s = STOPS[i];
    host.dataset.pose = s.pose; host.dataset.mood = s.mood; delete host.dataset.moodNow;
    host.__acdV = -1; K.mount();
    g.style.setProperty('--gy', s.y + 'vh');
    g.classList.toggle('on-dark', !!(s.el && s.el.classList.contains('dk')));
    if (!calm) { host.classList.remove('acd-hop'); void host.offsetWidth; host.classList.add('acd-hop'); }
    K.say(host, s.t, narrow() ? 3800 : 0);
    live.textContent = s.t;
  };
  STOPS.forEach(function (s, i) { s.el = D.querySelector(s.q); });
  var vis = STOPS.map(function () { return 0; });
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { var i = STOPS.findIndex(function (s) { return s.el === e.target; }); if (i > -1) vis[i] = e.isIntersecting ? e.intersectionRatio : 0; });
    var best = -1, bv = 0; vis.forEach(function (v, i) { if (v > bv) { bv = v; best = i; } });
    if (best > -1) go(best);
  }, { threshold: [0, .15, .3, .5, .7], rootMargin: '-20% 0px -30% 0px' });
  STOPS.forEach(function (s) { if (s.el) io.observe(s.el); });

  /* scroll hızına göre hafif yatma, sayfa sonunda saklanma */
  if (!calm) {
    var lastY = W.scrollY, raf = 0, tilt = 0;
    W.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0; var y = W.scrollY, v = y - lastY; lastY = y;
        tilt = Math.max(-14, Math.min(14, v * 0.6));
        g.style.setProperty('--gt', tilt.toFixed(1) + 'deg');
        clearTimeout(hideT); hideT = setTimeout(function () { g.style.setProperty('--gt', '0deg'); }, 160);
      });
    }, { passive: true });
  }
  var foot = D.querySelector('footer');
  if (foot) new IntersectionObserver(function (es) { g.classList.toggle('away', es[0].isIntersecting); }, { threshold: 0.2 }).observe(foot);
  /* paket panosu açıkken çekil */
  var board = D.querySelector('[data-pkt-board]');
  if (board && W.MutationObserver) new MutationObserver(function () { g.classList.toggle('away', !board.hidden); }).observe(board, { attributes: true, attributeFilter: ['hidden'] });

  /* tıklayınca zıpla, sıradaki cümle */
  host.style.pointerEvents = 'auto';
  host.addEventListener('click', function () {
    K.react(host, 'kirp', 1200);
    K.say(host, EXTRA[extraI++ % EXTRA.length], 3200);
  });
  W.addEventListener('load', function () { g.classList.add('in'); });
  setTimeout(function () { g.classList.add('in'); }, 1200);
})();
