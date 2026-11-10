/* ==========================================================================
   FORMULO · tanıtım sayfası sahnesi (index.html #formulo), 08.11.2026
   "Bir formülün dersi": sahne sabitlenir, kaydırma ilerlemesi (p) beş adımı yürütür:
   0 yazar (formül tebeşirle yazılır, terimler renklenir) · 1 çizer (atış yolu çizilir,
   top uçar) · 2 kaydırırsın (θ kaydırmayla değişir, yol ve R anında güncellenir) ·
   3 sorar (ara soru, doğru şık işaretlenir) · 4 cevaplar (Acadia'ya sor sohbeti).
   Profesör Acadia (AcadiaKit, kep + gözlük + papyon) tahtanın önünde anlatır.
   Hareket azaltılınca CSS her şeyi sabit gösterir; bu betik yalnız son durumu çizer.
   ========================================================================== */
(function () {
  'use strict';
  var W = window, D = document;
  var BALON = [
    'Önce formülü yazayım. R, yani menzil; v₀ hız, θ açı, g yerçekimi.',
    'Şimdi şeklini çizelim: top v₀ hızla, θ açısıyla fırlıyor.',
    'Açıyı sen değiştir: kaydırdıkça yol da R de değişiyor.',
    'Küçük bir soru: v₀ iki katına çıkarsa R ne olur?',
    'Takıldığın yerde bana sor. İstersen cevabı söylemeden ipucu veririm.'
  ];
  var DUYGU = [['mutlu', 'selam'], ['odakli', 'isaret'], ['odakli', 'isaret'], ['dusunuyor', 'dusun'], ['kutlama', 'oku']];
  var ZEMIN = 150, X0 = 34, OLCEK = 6.5, V0 = 20, G = 9.81;
  function yol(th, u) {
    var r = th * Math.PI / 180, R = V0 * V0 * Math.sin(2 * r) / G, H = V0 * V0 * Math.pow(Math.sin(r), 2) / (2 * G), d = '', n = 32;
    for (var i = 0; i <= n * u; i++) { var w = i / n; d += (i ? 'L' : 'M') + (X0 + R * OLCEK * w).toFixed(1) + ' ' + (ZEMIN - 4 * H * OLCEK * w * (1 - w)).toFixed(1); }
    return { d: d || 'M' + X0 + ' ' + ZEMIN, R: R, H: H, x: X0 + R * OLCEK * u, y: ZEMIN - 4 * H * OLCEK * u * (1 - u), r: r };
  }
  function prof(o) { if (!W.AcadiaKit) return ''; o.bas = 'kep'; o.goz = 'gozluk'; o.boyun = 'papyon'; return W.AcadiaKit.svg(o); }
  function sayi(x) { return (Math.round(x * 10) / 10).toFixed(1).replace('.', ','); }
  function kur() {
    var el = D.querySelector('[data-fmu]'); if (!el) return;
    var track = el.querySelector('.fmu-track'), plan = el.querySelectorAll('.fmu-plan li'), N = 5,
      sakin = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches,
      f = el.querySelector('[data-fmu-f]'), iz = el.querySelector('[data-fmu-iz]'), ok = el.querySelector('[data-fmu-ok]'), top = el.querySelector('[data-fmu-top]'),
      aci = el.querySelector('[data-fmu-aci]'), acY = el.querySelector('[data-fmu-acy]'), ray = el.querySelector('[data-fmu-ray]'), thT = el.querySelector('[data-fmu-th]'), RT = el.querySelector('[data-fmu-r]'), olcu = el.querySelector('[data-fmu-olcu]'),
      acd = el.querySelector('[data-fmu-acd]'), balon = el.querySelector('[data-fmu-balon]'), son = -1, sonA = -1;
    function sahne(th, u) {
      var y1 = yol(th, u), y0 = yol(th, 1);
      iz.setAttribute('d', y1.d); top.setAttribute('cx', y1.x.toFixed(1)); top.setAttribute('cy', y1.y.toFixed(1));
      ok.setAttribute('x2', (X0 + 46 * Math.cos(y1.r)).toFixed(1)); ok.setAttribute('y2', (ZEMIN - 46 * Math.sin(y1.r)).toFixed(1));
      var ex = X0 + 30 * Math.cos(y1.r), ey = ZEMIN - 30 * Math.sin(y1.r); acY.setAttribute('d', 'M' + (X0 + 30) + ' ' + ZEMIN + 'A30 30 0 0 0 ' + ex.toFixed(1) + ' ' + ey.toFixed(1));
      olcu.setAttribute('d', 'M' + X0 + ' 162H' + (X0 + y0.R * OLCEK).toFixed(1) + 'M' + X0 + ' 157V167M' + (X0 + y0.R * OLCEK).toFixed(1) + ' 157V167');
      ray.style.width = ((th - 10) / 70 * 100).toFixed(1) + '%'; thT.textContent = Math.round(th) + '°'; RT.textContent = sayi(y0.R);
      aci.setAttribute('transform', 'translate(' + (X0 + 40 * Math.cos(y1.r / 2)).toFixed(1) + ' ' + (ZEMIN - 40 * Math.sin(y1.r / 2) + 5).toFixed(1) + ')');
    }
    function adim(a) {
      if (a === sonA) return; sonA = a; el.dataset.a = a;
      plan.forEach(function (li, j) { li.classList.toggle('fmu-su', j === a); li.classList.toggle('fmu-gecti', j < a); var b = li.querySelector('button'); if (b) b.setAttribute('aria-current', j === a ? 'step' : 'false'); });
      if (acd) acd.innerHTML = prof({ mood: DUYGU[a][0], pose: DUYGU[a][1], size: 96 });
      if (balon) { balon.textContent = BALON[a]; balon.classList.remove('fmu-yeni'); void balon.offsetWidth; balon.classList.add('fmu-yeni'); }
    }
    function tik() {
      var p;
      if (sakin) p = .999; else { var r = track.getBoundingClientRect(), boy = track.offsetHeight - W.innerHeight; p = Math.min(.999, Math.max(0, -r.top / Math.max(1, boy))); }
      if (Math.abs(p - son) < .0004) return; son = p;
      var a = Math.min(N - 1, Math.floor(p * N)), q = p * N - a;
      el.style.setProperty('--p', p.toFixed(4)); el.style.setProperty('--q', q.toFixed(4));
      /* 0: formül yazılır, terimler sırayla renklenir */
      var yaz = a > 0 ? 1 : Math.min(1, q * 1.4);
      f.style.clipPath = 'inset(-30px ' + ((1 - yaz) * 100).toFixed(1) + '% -30px 0)';
      el.classList.toggle('fmu-v', a > 0 || q > .45); el.classList.toggle('fmu-t', a > 0 || q > .6); el.classList.toggle('fmu-g', a > 0 || q > .75);
      /* 1: yol çizilir, top uçar; 2: θ kaydırmayla değişir */
      var th = a < 2 ? 45 : a === 2 ? 15 + 60 * Math.min(1, q * 1.15) : 75;
      sahne(th, a < 1 ? 0 : a === 1 ? Math.min(1, q * 1.2) : 1);
      el.classList.toggle('fmu-dogru', a > 3 || (a === 3 && q > .5));
      el.classList.toggle('fmu-cvp', a === 4 && q > .35);
      adim(a);
    }
    var bekle = false, iste = function () { if (!bekle) { bekle = true; W.requestAnimationFrame(function () { bekle = false; tik(); }); } };
    if (!sakin) { W.addEventListener('scroll', iste, { passive: true }); W.addEventListener('resize', iste); }
    plan.forEach(function (li, j) {
      var b = li.querySelector('button'); if (!b) return;
      b.addEventListener('click', function () {
        if (sakin) return;
        var t = track.getBoundingClientRect().top + W.scrollY, boy = track.offsetHeight - W.innerHeight;
        W.scrollTo({ top: t + boy * (j + .55) / N, behavior: 'smooth' });
      });
    });
    tik(); adim(Math.min(N - 1, Math.floor((sakin ? .999 : son) * N)));
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', kur); else kur();
})();
