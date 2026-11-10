/* ==========================================================================
   ACADEX FİNANS · LİMAN DEFTERİ (js/acadex-liman.js + css/acadex-liman.css), 03.11.2026
   Finans panelinin başında ilerleme panosu:
     - gemi: her istasyon güvertede bir konteyner. Açılmamış istasyon boş çerçeve,
       açılan istasyon kendi renginde konteyner, karnesi %85 ve üstü olanda "onaylandı" mührü.
       Yeni yüklenen konteyner vinçten iner (bir kez).
     - sayılar: açılan istasyon, karne ortalaması, limanda geçen süre
     - "kaldığın yerden devam" ve "sıradaki öneri" (henüz açmadığın ilk istasyon)
     - konteyner ve kat kartlarında küçük durum etiketi (%92 ✓ / açıldı / yeni)
   Veri: lab'ların kendi kaydettiği acadex.finans.log (labs/finans/fn-app.js, bu tarayıcıda).
   Lab açıkken her güncellemede iframe 'progress' mesajı yollar; pano tazelenir.
   ========================================================================== */
(function () {
  'use strict';
  var sec = document.getElementById('finans-view'); if (!sec) return;
  var D = document, W = window;
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var RM = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var logOf = function () { return lsafe(function () { var o = JSON.parse(localStorage.getItem('acadex.finans.log') || 'null'); return o && o.tabs ? o : { tabs: {} }; }, { tabs: {} }); };
  var seenGet = function () { return lsafe(function () { return JSON.parse(localStorage.getItem('acadex.liman.seen') || 'null'); }, null); };
  var seenSet = function (a) { try { localStorage.setItem('acadex.liman.seen', JSON.stringify(a)); } catch (e) {} };
  /* panel anahtarı (zaman, sirket-sim) → defter anahtarı (finans.zaman, sirket.sim) */
  var logKey = function (k) { return /^sirket-/.test(k) ? 'sirket.' + k.slice(7) : 'finans.' + k; };
  var stations = function () {
    var seen = {}, out = [];
    Array.prototype.forEach.call(sec.querySelectorAll('[data-finans-open]'), function (b) {
      if (panel.contains(b) || b.hasAttribute('data-lm-skip')) return;
      var k = b.getAttribute('data-finans-open'); if (seen[k]) return; seen[k] = 1;
      var li = b.closest('li'), cc = (li && li.style.getPropertyValue('--cc')) || '#2F6FB0';
      var name = /^sirket-/.test(k) ? (W.AX_SIRKET || {})[k.slice(7)] : (W.AX_FINANS || {})[k];
      out.push({ k: k, b: b, cc: cc.trim(), name: name || k, kat: /^sirket-/.test(k) });
    });
    return out;
  };
  var dur = function (s) { s = Math.round(s / 60); if (s < 1) return 'birkaç dakika'; var h = Math.floor(s / 60), m = s % 60; return (h ? h + ' sa ' : '') + (m || !h ? m + ' dk' : ''); };

  var panel = D.createElement('section');
  panel.className = 'lm-board land'; panel.setAttribute('aria-labelledby', 'lm-t');
  var yard = sec.querySelector('.axf-yard');
  if (!yard) return;
  yard.parentNode.insertBefore(panel, yard);

  var shipSvg = function (st, log, fresh) {
    /* güverte: her istasyon bir yuva; 15'e kadar 3 sıra × 5, daha fazlasında 4 sıra (24 istasyon: 6 × 4); alttan yukarı dolar */
    var cols = st.length <= 15 ? 5 : Math.ceil(st.length / 4), rows = Math.ceil(st.length / cols), w = cols <= 5 ? 38 : Math.floor(204 / cols) - 3, h = rows <= 3 ? 22 : 16, x0 = cols <= 5 ? 62 : 52, yb = 86, s = '';
    st.forEach(function (o, i) {
      var r = log.tabs[logKey(o.k)], col = i % cols, row = Math.floor(i / cols), x = x0 + col * (w + 3), y = yb - (row + 1) * (h + 2);
      if (!r || !r.v) { s += '<rect class="lm-slot" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="2"/>'; return; }
      var ok = r.best != null && r.best >= 85, nw = fresh.indexOf(o.k) > -1;
      s += '<g class="lm-box' + (nw ? ' lm-new' : '') + '" style="--d:' + (fresh.indexOf(o.k) * 0.25) + 's"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="2" fill="' + esc(o.cc) + '" stroke="#0D1838" stroke-width="1.4"/>' +
        '<path d="' + [0.18, 0.39, 0.6, 0.81].map(function (q) { return 'M' + (x + Math.round(w * q)) + ' ' + (y + 3) + ' V' + (y + h - 3); }).join(' ') + '" stroke="rgba(0,0,0,.22)" stroke-width="1.2"/>' +
        (ok ? '<circle cx="' + (x + w - 7) + '" cy="' + (y + 7) + '" r="6" fill="#FFFDF8" stroke="#1E8A55" stroke-width="1.6"/><path d="M' + (x + w - 10) + ' ' + (y + 7) + ' l2 2.4 l4 -4.6" fill="none" stroke="#1E8A55" stroke-width="1.8" stroke-linecap="round"/>' : '') + '</g>';
    });
    return '<svg class="lm-ship" viewBox="0 0 330 130" role="img" aria-label="Gemi: ' + st.filter(function (o) { var r = log.tabs[logKey(o.k)]; return r && r.v; }).length + ' / ' + st.length + ' konteyner yüklü">' +
      '<rect x="0" y="0" width="330" height="130" rx="12" fill="#DCEBF6"/>' +
      '<g class="lm-crane"><path d="M292 112 V10 M250 14 H318 M292 30 L314 14" stroke="#0D1838" stroke-width="3" fill="none"/><path class="lm-hook" d="M262 14 V40 M256 40 H268" stroke="#0D1838" stroke-width="1.6" fill="none"/></g>' +
      '<g class="lm-float">' + s + '<path d="M44 86 H284 L268 108 H60 Z" fill="#1E5B8C" stroke="#0D1838" stroke-width="2"/><path d="M60 96 H272" stroke="rgba(255,255,255,.35)" stroke-width="2"/><text x="164" y="104" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="8" fill="#DCEBF6">ACADEX · MAVİ LİMAN</text></g>' +
      '<rect x="0" y="104" width="330" height="26" fill="#2C77B0"/><g class="lm-wv" fill="#fff" opacity=".3"><rect x="20" y="112" width="26" height="3" rx="1.5"/><rect x="110" y="120" width="34" height="3" rx="1.5"/><rect x="210" y="113" width="24" height="3" rx="1.5"/></g></svg>';
  };

  var paint = function () {
    var st = stations(), log = logOf(), seen = seenGet(), fresh = [];
    var opened = st.filter(function (o) { var r = log.tabs[logKey(o.k)]; return r && r.v; });
    var graded = st.map(function (o) { return log.tabs[logKey(o.k)]; }).filter(function (r) { return r && r.best != null; });
    var avg = graded.length ? Math.round(graded.reduce(function (a, r) { return a + r.best; }, 0) / graded.length) : null;
    var secs = st.reduce(function (a, o) { var r = log.tabs[logKey(o.k)]; return a + (r ? r.sec || 0 : 0); }, 0);
    var okN = graded.filter(function (r) { return r.best >= 85; }).length;
    if (seen) opened.forEach(function (o) { if (seen.indexOf(o.k) < 0) fresh.push(o.k); });
    var lastKey = log.last, last = st.filter(function (o) { return logKey(o.k) === lastKey; })[0];
    var next = st.filter(function (o) { var r = log.tabs[logKey(o.k)]; return !r || !r.v; })[0];
    panel.innerHTML =
      '<div class="lm-l">' + shipSvg(st, log, RM ? [] : fresh) + '</div>' +
      '<div class="lm-r"><span class="eyb hand">liman defteri</span><h2 class="disp" id="lm-t">' + (opened.length ? opened.length + ' / ' + st.length + ' konteyner gemide' : 'Gemi seni bekliyor') + '</h2>' +
      '<ul class="lm-stats">' +
        '<li><b>' + opened.length + '</b><span>açılan istasyon</span></li>' +
        '<li><b>' + (avg == null ? '—' : '%' + avg) + '</b><span>karne ortalaması' + (graded.length ? ' · ' + graded.length + ' karne' : '') + '</span></li>' +
        '<li><b>' + okN + '</b><span>onaylanan konteyner</span></li>' +
        '<li><b>' + (secs ? dur(secs) : '—') + '</b><span>limanda geçen süre</span></li>' +
      '</ul>' +
      '<div class="lm-acts">' +
        (last ? '<button type="button" class="lm-go" data-finans-open="' + esc(last.k) + '">kaldığın yerden devam: <b>' + esc(last.name) + '</b> →</button>' : '') +
        (next ? '<button type="button" class="lm-next" data-finans-open="' + esc(next.k) + '">' + (opened.length ? 'sıradaki öneri: ' : 'ilk konteyner: ') + '<b>' + esc(next.name) + '</b></button>' : '<span class="lm-all hand">bütün konteynerler gemide, kaptan!</span>') +
      '</div><p class="lm-note">ilerlemen bu tarayıcıda tutulur · karnesi %85 ve üstü olan konteyner onaylanır</p></div>';
    /* kartlardaki küçük etiket */
    st.forEach(function (o) {
      var r = log.tabs[logKey(o.k)], tag = o.b.querySelector('.lm-tag');
      if (!tag) { tag = D.createElement('span'); tag.className = 'lm-tag'; tag.setAttribute('aria-hidden', 'true'); o.b.appendChild(tag); }
      var txt = !r || !r.v ? 'yeni' : r.best != null ? '%' + r.best + (r.best >= 85 ? ' ✓' : '') : 'açıldı';
      tag.textContent = txt; tag.className = 'lm-tag' + (!r || !r.v ? ' is-new' : r.best != null && r.best >= 85 ? ' is-ok' : r.best != null ? ' is-try' : ' is-open');
    });
    if (fresh.length && !RM) { panel.classList.remove('lm-load'); void panel.offsetWidth; panel.classList.add('lm-load'); setTimeout(function () { panel.classList.remove('lm-load'); }, 1800 + fresh.length * 250); }
    seenSet(opened.map(function (o) { return o.k; }));
  };
  paint();
  W.addEventListener('message', function (e) {
    if (e.origin !== location.origin) return;
    var d = e.data; if (d && d.src === 'axlab' && d.type === 'progress') { clearTimeout(paint.t); paint.t = setTimeout(paint, 300); }
  });
  W.addEventListener('storage', function (e) { if (e.key === 'acadex.finans.log') paint(); });
  if ('MutationObserver' in W) new MutationObserver(function () { if (sec.classList.contains('active')) paint(); }).observe(sec, { attributes: true, attributeFilter: ['class'] });
  W.AXLiman = { paint: paint, logKey: logKey };
})();
