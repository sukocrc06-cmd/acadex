/* ==========================================================================
   ACADEX MEDLAB · CİHAZ DEPOSU (labs/depo/depo.js), 27.11.2026
   Depo sahnesi (bölüm dolapları) → bölüm şeridi → katalog → cihaz kartı (numaralı parçalar,
   ne işe yarar, kullanım, dikkat) → kullanım simülasyonu (depo-sim.js, DEPOSIM).
   Veri: depo-veri.js (AXDEPO) + bölüm dosyaları (depo-muayene.js, depo-ek-*.js) aynı listeye ekler.
   İncelenen cihazlar ve simülasyon puanları cihazda saklanır (acadex.depo.*).
   ========================================================================== */
(function () {
  'use strict';
  var D = document, W = window, V = W.AXDEPO; if (!V) return;
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var X = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var RM = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var ls = {
    get: function (k, d) { try { var v = localStorage.getItem('acadex.depo.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('acadex.depo.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  var norm = function (t) { return String(t || '').toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i'); };

  var CIHAZ = V.CIHAZ.slice();
  var BOL = V.BOLUM, bolum = function (id) { return BOL.filter(function (b) { return b.id === id; })[0]; };
  var bul = function (id) { return CIHAZ.filter(function (c) { return c.id === id; })[0]; };
  var gor = ls.get('gor', []), simP = ls.get('sim', {});
  var S = { b: ls.get('bolum', null), q: '', sim: false };

  var svg = function (c, parcali) {
    var s = '<svg viewBox="0 0 240 160" role="img" aria-label="' + X(c.ad) + ' çizimi">' + c.ciz;
    if (parcali) (c.parca || []).forEach(function (p, i) { s += '<g class="p" data-p="' + i + '" style="animation-delay:' + (RM ? 0 : 0.12 + i * 0.07) + 's;transform-origin:' + p[1] + 'px ' + p[2] + 'px"><circle cx="' + p[1] + '" cy="' + p[2] + '" r="7.5"/><text x="' + p[1] + '" y="' + p[2] + '">' + (i + 1) + '</text></g>'; });
    return s + '</svg>';
  };

  /* ---------------- depo sahnesi: bölüm başına bir dolap ---------------- */
  var sahne = function () {
    var w = 1200, h = 420, n = BOL.length, dw = Math.min(112, (w - 60 - (n - 1) * 10) / n), gap = (w - 60 - n * dw) / (n - 1), s = '';
    s += '<svg viewBox="0 0 ' + w + ' ' + h + '" role="group" aria-label="Depo: bölüm dolapları">';
    s += '<defs><linearGradient id="dpz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9D0D8"/><stop offset="1" stop-color="#AEB7C2"/></linearGradient><linearGradient id="dpd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EEF1F4"/><stop offset="1" stop-color="#DDE3EA"/></linearGradient><linearGradient id="dpk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#D5DCE4"/><stop offset=".5" stop-color="#EEF2F6"/><stop offset="1" stop-color="#C8D0DA"/></linearGradient></defs>';
    s += '<rect width="' + w + '" height="' + h + '" fill="url(#dpd)"/><rect y="336" width="' + w + '" height="84" fill="url(#dpz)"/><path d="M0 336H' + w + '" stroke="#8D98A8" stroke-width="3"/>';
    for (var x = 0; x < w; x += 80) s += '<path d="M' + x + ' 336 L' + (x - 60) + ' 420" stroke="#B5BEC9" stroke-width="1.5"/>';
    [200, 600, 1000].forEach(function (lx) { s += '<g class="lamba"><rect x="' + (lx - 60) + '" y="0" width="120" height="10" rx="4" fill="#fff"/><path d="M' + (lx - 60) + ' 10 L' + (lx - 140) + ' 200 L' + (lx + 140) + ' 200 L' + (lx + 60) + ' 10 Z" fill="#FFFBEA" opacity=".35"/></g>'; });
    s += '<g><rect x="30" y="20" width="250" height="40" rx="8" fill="#0D1838"/><text x="155" y="47" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="17" font-weight="700" fill="#fff" letter-spacing="3">CİHAZ DEPOSU</text></g>';
    BOL.forEach(function (b, i) {
      var x = 30 + i * (dw + gap), y = 92, dh = 244, say = CIHAZ.filter(function (c) { return c.b === b.id; }).length;
      var ic = '';
      CIHAZ.filter(function (c) { return c.b === b.id; }).slice(0, 6).forEach(function (c, j) {
        var iw = (dw - 12) / 2, cx = x + 4 + (j % 2) * (iw + 4), cy = y + 34 + Math.floor(j / 2) * 64;
        ic += '<svg x="' + cx + '" y="' + cy + '" width="' + iw + '" height="' + (iw * 2 / 3) + '" viewBox="0 0 240 160">' + c.ciz + '</svg>';
      });
      s += '<g class="dp-dolap' + (S.b === b.id ? ' acik' : '') + '" data-b="' + b.id + '" tabindex="0" role="button" aria-label="' + X(b.ad) + ' dolabı: ' + say + ' cihaz">';
      s += '<rect class="cerceve" x="' + x + '" y="' + y + '" width="' + dw + '" height="' + dh + '" rx="6" fill="#F7F9FB" stroke="#8D98A8" stroke-width="3"/>';
      [0, 1, 2].forEach(function (r) { s += '<rect x="' + (x + 4) + '" y="' + (y + 90 + r * 64) + '" width="' + (dw - 8) + '" height="5" fill="#B9C3CF"/>'; });
      s += '<g class="ic">' + ic + '</g>';
      s += '<g class="kapi kapiL"><rect x="' + x + '" y="' + (y + 22) + '" width="' + dw / 2 + '" height="' + (dh - 22) + '" fill="url(#dpk)" stroke="#8D98A8" stroke-width="2"/><rect x="' + (x + dw / 2 - 10) + '" y="' + (y + 120) + '" width="5" height="26" rx="2" fill="#6E7A90"/></g>';
      s += '<g class="kapi kapiR"><rect x="' + (x + dw / 2) + '" y="' + (y + 22) + '" width="' + dw / 2 + '" height="' + (dh - 22) + '" fill="url(#dpk)" stroke="#8D98A8" stroke-width="2"/><rect x="' + (x + dw / 2 + 5) + '" y="' + (y + 120) + '" width="5" height="26" rx="2" fill="#6E7A90"/></g>';
      s += '<rect x="' + x + '" y="' + y + '" width="' + dw + '" height="22" rx="6" fill="' + b.renk + '"/><text x="' + (x + dw / 2) + '" y="' + (y + 15) + '" text-anchor="middle" font-family="Instrument Sans,sans-serif" font-size="' + (dw < 100 ? 10.5 : 11.5) + '" font-weight="700" fill="#fff">' + X(b.etiket || (b.ad.length > (dw < 100 ? 13 : 16) ? b.ad.split(' ')[0] : b.ad)) + '</text>';
      s += '<rect x="' + (x + dw / 2 - 18) + '" y="' + (y + dh + 6) + '" width="36" height="18" rx="9" fill="#fff" stroke="' + b.renk + '" stroke-width="2"/><text x="' + (x + dw / 2) + '" y="' + (y + dh + 19) + '" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" font-weight="700" fill="#0D1838">' + say + '</text>';
      s += '</g>';
    });
    s += '</svg><span class="dp-ipucu">Bir dolaba dokun · ' + CIHAZ.length + ' cihaz</span>';
    $('#dp-sahne').innerHTML = s;
  };

  var bolSerit = function () {
    $('#dp-bl').innerHTML = '<button type="button" data-bb="" style="--bc:#0D1838" aria-pressed="' + (!S.b) + '"><i></i>Hepsi</button>' +
      BOL.map(function (b) { return '<button type="button" data-bb="' + b.id + '" style="--bc:' + b.renk + '" aria-pressed="' + (S.b === b.id) + '"><i></i>' + X(b.ad) + '</button>'; }).join('');
  };
  var sayac = function () {
    var simli = CIHAZ.filter(function (c) { return c.sim; }), yap = simli.filter(function (c) { return simP[c.sim] != null; }).length;
    $('#dp-say').innerHTML = '<span>' + gor.length + ' / ' + CIHAZ.length + ' incelendi</span><span>' + yap + ' / ' + simli.length + ' simülasyon</span>';
  };
  var katalog = function () {
    var q = norm(S.q), h = '';
    BOL.forEach(function (b) {
      if (S.b && S.b !== b.id) return;
      var L = CIHAZ.filter(function (c) { return c.b === b.id && (!S.sim || c.sim) && (!q || norm(c.ad + ' ' + c.kisa + ' ' + c.ne).indexOf(q) >= 0); });
      if (!L.length) return;
      h += '<h2 style="--bc:' + b.renk + '"><i></i>' + X(b.ad) + '<small>' + X(b.kisa) + ' · ' + L.length + ' cihaz</small></h2><div class="dp-g">' +
        L.map(function (c) { return '<button type="button" class="dp-c" data-c="' + c.id + '" style="--bc:' + b.renk + '">' + svg(c) + '<span class="rz">' + (c.sim ? '<em class="s">▶ simülasyon</em>' : '') + (gor.indexOf(c.id) >= 0 ? '<em class="g">✓</em>' : '') + '</span><b>' + X(c.ad) + '</b><span>' + X(c.kisa) + '</span></button>'; }).join('') + '</div>';
    });
    $('#dp-kat').innerHTML = h || '<p class="dp-bos">Aramaya uyan cihaz yok. Başka bir sözcük dene.</p>';
  };
  var ciz = function () { sahne(); bolSerit(); katalog(); sayac(); };
  var bolSec = function (id, kaydir) {
    S.b = id || null; ls.set('bolum', S.b); ciz();
    if (kaydir) { var el = $('#dp-bl'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); }
  };

  /* ---------------- katman: cihaz kartı ve simülasyon ---------------- */
  var K = null, once = null;
  var kapat = function () { if (!K) return; if (K.dur) try { K.dur(); } catch (e) {} K.el.remove(); K = null; D.body.style.overflow = ''; D.body.classList.remove('dp-acik'); D.removeEventListener('keydown', tus, true); if (once && once.focus) try { once.focus({ preventScroll: true }); } catch (e) {} katalog(); sayac(); };
  var tus = function (e) { if (e.key === 'Escape') { e.preventDefault(); kapat(); } };
  var katman = function () {
    if (K) { if (K.dur) try { K.dur(); } catch (e) {} K.dur = null; return K; }
    once = D.activeElement;
    var el = D.createElement('div'); el.className = 'dp-kat-o'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = '<div class="dp-k"><div class="dp-ku"></div><div class="dp-ki"></div></div>';
    D.body.appendChild(el); D.body.style.overflow = 'hidden'; D.body.classList.add('dp-acik'); D.addEventListener('keydown', tus, true);
    el.addEventListener('click', function (e) { if (e.target === el) kapat(); });
    K = { el: el }; return K;
  };
  var ust = function (baslik, alt, sag) {
    $('.dp-ku', K.el).innerHTML = '<div><h2>' + X(baslik) + '</h2><small>' + X(alt) + '</small></div><div class="sag">' + (sag || '') + '<button type="button" class="dp-x" data-k="x" aria-label="Kapat">×</button></div>';
    K.el.setAttribute('aria-label', baslik);
  };
  var kart = function (id) {
    var c = bul(id); if (!c) return; katman(); var b = bolum(c.b);
    if (gor.indexOf(id) < 0) { gor.push(id); ls.set('gor', gor); }
    var L = CIHAZ.filter(function (x) { return x.b === c.b; }), i = L.indexOf(c), onc = L[(i + L.length - 1) % L.length], son = L[(i + 1) % L.length];
    ust(c.ad, b.ad + ' · ' + (i + 1) + ' / ' + L.length, '');
    var h = '<div class="dp-d" style="--bc:' + b.renk + '"><div><div class="dp-res">' + svg(c, true) + '</div>' +
      (c.parca && c.parca.length ? '<ul class="dp-pl">' + c.parca.map(function (p, j) { return '<li><button type="button" data-p="' + j + '" aria-pressed="false"><b>' + (j + 1) + '</b>' + X(p[0]) + '</button></li>'; }).join('') + '</ul>' : '') + '</div>' +
      '<div class="dp-m"><h3>' + X(c.ad) + '</h3><p class="ks">' + X(c.kisa) + '</p>' +
      (c.sim && W.DEPOSIM && W.DEPOSIM[c.sim] ? '<div class="dp-simk"><div><b>Kullanım simülasyonu</b><p>' + X(W.DEPOSIM[c.sim].ozet) + (simP[c.sim] != null ? ' · en iyi: ' + simP[c.sim] + '/100' : '') + '</p></div><button type="button" class="dp-b" data-k="sim">▶ Başlat</button></div>' : '') +
      '<section><h4>Ne işe yarar</h4><p>' + X(c.ne) + '</p></section>' +
      '<section><h4>Nasıl kullanılır</h4><ol>' + c.adim.map(function (t) { return '<li>' + X(t) + '</li>'; }).join('') + '</ol></section>' +
      '<section class="dk"><h4>Dikkat · sık hatalar</h4><ul>' + c.dikkat.map(function (t) { return '<li>' + X(t) + '</li>'; }).join('') + '</ul></section>' +
      '<div class="dp-ak"><button type="button" class="dp-b" data-c="' + onc.id + '">← ' + X(onc.ad) + '</button><button type="button" class="dp-b" data-c="' + son.id + '">' + X(son.ad) + ' →</button></div></div></div>';
    var ki = $('.dp-ki', K.el); ki.innerHTML = h; ki.scrollTop = 0; K.c = c;
    setTimeout(function () { var x = $('[data-k="sim"]', K && K.el) || $('[data-k="x"]', K && K.el); if (x) try { x.focus({ preventScroll: true }); } catch (e) {} }, 30);
  };
  var simAc = function (c) {
    var M = W.DEPOSIM && W.DEPOSIM[c.sim]; if (!M) return; katman(); var b = bolum(c.b);
    ust(c.ad + ' · simülasyon', M.ozet, '<button type="button" class="dp-b" data-c="' + c.id + '">← Cihaz kartı</button>');
    var ki = $('.dp-ki', K.el); ki.innerHTML = ''; ki.scrollTop = 0; ki.style.setProperty('--bc', b.renk);
    ki.__dur = M.baslat(ki, function (puan) {
      puan = Math.max(0, Math.min(100, Math.round(puan)));
      if (simP[c.sim] == null || puan > simP[c.sim]) { simP[c.sim] = puan; ls.set('sim', simP); }
      return simP[c.sim];
    }) || null;
    /* "Yeniden dene" simülasyonu yeniden kurar ve yeni durdurucuyu ki.__dur'a yazar */
    K.dur = function () { if (typeof ki.__dur === 'function') ki.__dur(); ki.__dur = null; };
  };
  D.addEventListener('click', function (e) {
    var t = e.target;
    var dl = t.closest && t.closest('.dp-dolap'); if (dl) { bolSec(S.b === dl.getAttribute('data-b') ? null : dl.getAttribute('data-b'), true); return; }
    var bb = t.closest && t.closest('[data-bb]'); if (bb) { bolSec(bb.getAttribute('data-bb')); return; }
    var cc = t.closest && t.closest('[data-c]'); if (cc) { kart(cc.getAttribute('data-c')); return; }
    if (!K) return;
    var p = t.closest('[data-p]'); if (p && K.el.contains(p)) {
      var n = p.getAttribute('data-p');
      Array.prototype.forEach.call(K.el.querySelectorAll('.dp-res .p'), function (g) { g.classList.toggle('on', g.getAttribute('data-p') === n); });
      Array.prototype.forEach.call(K.el.querySelectorAll('.dp-pl [data-p]'), function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-p') === n ? 'true' : 'false'); });
      return;
    }
    var k = t.closest('[data-k]'); if (!k) return;
    if (k.getAttribute('data-k') === 'x') kapat(); else if (k.getAttribute('data-k') === 'sim' && K.c) simAc(K.c);
  });
  D.addEventListener('keydown', function (e) { var dl = e.target.closest && e.target.closest('.dp-dolap'); if (dl && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); dl.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
  var at = null;
  $('#dp-ara').addEventListener('input', function (e) { clearTimeout(at); at = setTimeout(function () { S.q = e.target.value; if (S.q && S.b) { S.b = null; bolSerit(); sahne(); } katalog(); }, 120); });
  $('#dp-simf').addEventListener('click', function () { S.sim = !S.sim; this.setAttribute('aria-pressed', S.sim ? 'true' : 'false'); katalog(); });
  ciz();
  /* ?cihaz=defib ya da ?sim=defib ile doğrudan aç (Medica ve diğer lablardan bağlantı) */
  var m = /[?&](cihaz|sim)=([\w-]+)/.exec(location.search);
  if (m) { var c0 = bul(m[2]) || CIHAZ.filter(function (c) { return c.sim === m[2]; })[0]; if (c0) { kart(c0.id); if (m[1] === 'sim' && c0.sim) simAc(c0); } }
  W.AXDEPOUI = { CIHAZ: CIHAZ, kart: kart, kapat: kapat };
})();
