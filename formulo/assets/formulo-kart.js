/* ==========================================================================
   FORMULO · ana sayfa kartı (formulo/assets/formulo-kart.js), 08.11.2026
   Günün formülü (tarihe göre, hesaplanabilir formüllerden) tebeşirle yazılır;
   "Kendini dene" kartın içinde soru açar; "Kaldığın yer" formulo.son'dan gelir.
   Dashboard'a girerken [data-fok] taşıyan kart bu betikle dolar; data-fok-kok bağlantıların önüne eklenir (masada "formulo/").
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, FO = W.FORMULO;
  var SAKIN = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function al(k, v) { try { var x = localStorage.getItem('formulo.' + k); return x ? JSON.parse(x) : v; } catch (e) { return v; } }
  function koy(k, v) { try { localStorage.setItem('formulo.' + k, JSON.stringify(v)); } catch (e) { } if (W.FOBULUT) W.FOBULUT.degisti(k); }   /* hesaba kayıt: formulo-bulut.js */
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function sayi(n) {
    if (!isFinite(n)) return '—';
    var a = Math.abs(n), s;
    if (a !== 0 && (a >= 1e6 || a < 1e-3)) { var e = Math.floor(Math.log10(a)); s = (+(n / Math.pow(10, e)).toFixed(3)) + ' × 10' + String(e).replace(/-/g, '⁻').replace(/\d/g, function (d) { return '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]; }); }
    else s = String(+n.toPrecision(4));
    return s.replace('.', ',');
  }
  function gunun(ofset) {
    var hes = FO.formuller.filter(function (f) { return f.o; }), d = new Date(), gun = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
    return hes[((gun * 7 + (ofset || 0)) % hes.length + hes.length) % hes.length];
  }
  function dersBul(id) { return FO.dersler.filter(function (d) { return d.id === id; })[0]; }
  function sembol(f, key) { var t = D.createElement('div'); t.innerHTML = f.h; var e = t.querySelector('[data-v="' + key + '"]'); return e ? e.innerHTML : key; }
  var SEMA = {
    calc1: '<path class="e" d="M6 52 C 36 52, 50 10, 80 16 S 128 44, 154 10"/><line class="t" x1="30" y1="50" x2="118" y2="4"/>',
    calc2: '<path class="e" d="M6 34 C 22 6, 40 6, 56 34 S 90 62, 106 34 S 140 6, 154 34"/>',
    fiz1: '<path class="e" d="M6 56 Q 80 -24 154 56"/><circle class="n" r="5"><animateMotion dur="2.6s" repeatCount="2" fill="freeze" path="M6 56 Q 80 -24 154 56"/></circle>',
    fiz2: '<path class="e" d="M0 32 Q 10 6 20 32 T 40 32 T 60 32 T 80 32 T 100 32 T 120 32 T 140 32 T 160 32"/>',
    lin: '<path class="e" d="M20 10 V56 M50 10 V56 M80 10 V56 M110 10 V56 M140 10 V56 M10 22 H150 M10 44 H150"/><path class="t q" d="M50 44 H80 V22 H50 Z"/>',
    dif: '<path class="e" d="M6 50 C 50 48, 100 40, 154 6"/>',
    ist: '<path class="e" d="M6 56 C 50 56, 60 6, 80 6 S 110 56, 154 56"/>',
    say: '<path class="e" d="M6 56 C 60 54, 110 34, 154 4"/><path class="t" d="M140 12 L104 46"/>'
  };

  function kur() {
    var el = D.querySelector('[data-fok]'); if (!el || !FO) return;
    var KOK = el.getAttribute('data-fok-kok') || ''; /* Acadex masasında: formulo/ */
    var ofset = 0, f, deg;
    function ciz(anim) {
      f = gunun(ofset); var d = dersBul(f.d);
      deg = {}; Object.keys(f.v).forEach(function (k) { deg[k] = f.v[k].val; });
      el.style.setProperty('--fok-c', d.renk);
      var fx = el.querySelector('[data-fok-f]');
      fx.innerHTML = f.h; fx.classList.remove('fok-yaz'); if (anim && !SAKIN) { void fx.offsetWidth; fx.classList.add('fok-yaz'); }
      el.querySelector('[data-fok-ad]').textContent = f.tr;
      el.querySelector('[data-fok-ders]').textContent = d.kod + ' · ' + d.tr;
      el.querySelector('[data-fok-sema]').innerHTML = SEMA[d.id] || '';
      el.querySelector('[data-fok-dene]').hidden = true;
      el.querySelector('[data-fok-git]').href = KOK + 'index.html?f=' + f.id + '#/' + d.id;
    }
    ciz(true);
    el.querySelector('[data-fok-baska]').addEventListener('click', function () { ofset++; ciz(true); });
    /* kendini dene */
    el.querySelector('[data-fok-dene-ac]').addEventListener('click', function () {
      var v = {}; Object.keys(f.v).forEach(function (k) { var q = f.v[k], n = q.min + Math.round(Math.random() * 20) * (q.max - q.min) / 20; n = Math.round(n / q.st) * q.st; n = +n.toPrecision(2); if (q.min > 0 && n <= 0) n = q.st; v[k] = Math.min(q.max, Math.max(q.min, n)); /* yuvarlak, okunur değerler */ });
      var dogru = f.o.f(v); if (!isFinite(dogru)) { this.click(); return; }
      var k = el.querySelector('[data-fok-dene]'); k.hidden = false;
      k.innerHTML = '<p class="fok-dene-s">' + Object.keys(v).map(function (x) { return '<span><b>' + sembol(f, x) + '</b> = ' + sayi(v[x]) + (f.v[x].u ? ' ' + esc(f.v[x].u) : '') + '</span>'; }).join('') + '</p>' +
        '<form class="fok-dene-f"><label><b>' + FO.os(f.o.s) + '</b> = <input type="text" inputmode="decimal" autocomplete="off" aria-label="Cevabın"> <em>' + esc(f.o.u) + '</em></label><button type="submit">Kontrol et</button></form><p class="fok-dene-c" aria-live="polite"></p>';
      var form = k.querySelector('form'), inp = form.querySelector('input'), c = k.querySelector('.fok-dene-c');
      inp.focus({ preventScroll: true });
      form.addEventListener('submit', function (e) {
        e.preventDefault(); var x = parseFloat(String(inp.value).replace(',', '.').replace(/\s/g, ''));
        var ok = isFinite(x) && Math.abs(x - dogru) <= Math.max(Math.abs(dogru) * 0.02, 1e-9);
        c.className = 'fok-dene-c ' + (ok ? 'fok-ok' : 'fok-no'); c.innerHTML = ok ? '✓ Doğru! Seri +1' : '✗ Doğrusu: <b>' + sayi(dogru) + ' ' + esc(f.o.u) + '</b>';
        if (ok) { var s = al('seri', { n: 0, gun: '' }), bugun = new Date().toDateString(); if (s.gun !== bugun) { s.n++; s.gun = bugun; koy('seri', s); } seriYaz(); }
        koy('son', { d: f.d, k: f.k, id: f.id, ts: Date.now() }); sonYaz();
      });
    });
    function sonYaz() {
      var s = al('son', null), kut = el.querySelector('[data-fok-son]');
      var ff = s && FO.formuller.filter(function (x) { return x.id === s.id; })[0];
      if (!ff) { kut.innerHTML = '<span class="fok-son-bos">Henüz çalışmadın. Calculus I ile başla →</span>'; kut.href = KOK + 'index.html#/calc1'; return; }
      var d = dersBul(ff.d), k = d.konular.filter(function (x) { return x.id === ff.k; })[0];
      kut.href = KOK + 'index.html?f=' + ff.id + '#/' + d.id;
      kut.innerHTML = '<i style="--c:' + d.renk + '"></i><span><small>kaldığın yer</small><b>' + esc(d.tr) + ' · ' + esc(k.tr) + '</b><span>' + esc(ff.tr) + '</span></span><em>→</em>';
    }
    function seriYaz() { var s = al('seri', { n: 0 }); el.querySelector('[data-fok-seri]').textContent = s.n ? s.n + ' gün seri' : 'seri başlat'; }
    sonYaz(); seriYaz();
    D.addEventListener('formulo:bulut', function () { sonYaz(); seriYaz(); });   /* başka cihazdaki ilerleme geldi */
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', kur); else kur();
})(window);
