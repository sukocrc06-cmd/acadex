/* ==========================================================================
   ACADEX · CANLI MASA TAKVİMİ (js/acadex-takvim.js + css/acadex-takvim.css), 03.11.2026
   Planlayıcının takvimi (acadex-ink.js, "ÇALIŞMA PLANLAYICI") zaten spiral, sayfa çevirme,
   yapışkan notlar ve sürükle-bırak yapıyor. Bu katman takvimi canlandırır:
     - ay başlığının yanında mevsim penceresi: kasımda yaprak düşer, kışın kar yağar,
       baharda çiçek açar, yazın güneş döner (ay değişince sahne de değişir)
     - bugün: mavi keçeli kalemle çizilen bir halka + "bugün" notu
     - bu hafta fosforlu bir şeritle, geçmiş günler soluk ve kurşun kalemle çizili
     - notlar türüne göre: çalışma mavi kâğıt + ataş, ödev sarı kâğıt + bant, sınav raptiyeli;
       tamamlanan nota yeşil "tamam" damgası
     - sınav günü: kırmızı halkanın yanında "6 gün" etiketi
     - ay çevrilince notlar sırayla düşer, spiral sallanır
   Takvimin verisi, kaydı ve olayları acadex-ink.js'te; burada yalnızca süsleme var
   (her çizimden sonra MutationObserver ile).
   ========================================================================== */
(function () {
  'use strict';
  var root = document.getElementById('planner-view');
  if (!root || !root.classList.contains('axp')) return;
  var D = document, W = window;
  var days = root.querySelector('[data-days]'), monthT = root.querySelector('[data-month-t]'), wall = root.querySelector('.wall');
  if (!days || !monthT || !wall) return;
  var RM = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var pad = function (n) { return ('0' + n).slice(-2); };
  var ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var toD = function (k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  var MONTHS = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];

  /* ---------- mevsim penceresi ---------- */
  var season = function (m) { return m === 11 || m <= 1 ? 'kis' : m <= 4 ? 'bahar' : m <= 7 ? 'yaz' : 'guz'; };
  var SCENE = {
    kis: '<rect class="sky" x="0" y="0" width="120" height="60" fill="#DCE8FA"/><path d="M0 50 C20 44 40 48 60 45 C80 42 100 47 120 44 V60 H0 Z" fill="#fff"/>' +
      '<path d="M84 46 L92 30 L100 46 Z M88 38 L92 30 L96 38" fill="#2E7D6B"/><rect x="91" y="46" width="2" height="4" fill="#8E6638"/>' +
      [10, 26, 44, 60, 76, 98, 112].map(function (x, i) { return '<circle class="flake" cx="' + x + '" cy="-4" r="' + (i % 2 ? 1.6 : 2.2) + '" fill="#fff" style="--dl:' + (i * 0.55) + 's;--dx:' + (i % 2 ? 6 : -5) + 'px"/>'; }).join(''),
    bahar: '<rect class="sky" x="0" y="0" width="120" height="60" fill="#E4F4EC"/><path d="M0 52 C30 46 60 50 120 46 V60 H0 Z" fill="#9BD3A8"/>' +
      [[24, 'F4A7B9'], [52, 'FFD34D'], [82, 'C7B3F0'], [104, 'F4A7B9']].map(function (f, i) { return '<g class="flower" style="--dl:' + (i * 0.4) + 's"><path d="M' + f[0] + ' 52 V38" stroke="#2E7D6B" stroke-width="1.6"/><circle cx="' + f[0] + '" cy="36" r="5" fill="#' + f[1] + '"/><circle cx="' + f[0] + '" cy="36" r="1.8" fill="#B4511F"/></g>'; }).join('') +
      '<path class="bfly" d="M62 20 c-5 -6 -9 -1 -6 3 c-4 2 -1 7 6 2 c7 5 10 0 6 -2 c3 -4 -1 -9 -6 -3 Z" fill="#2F6BFF" opacity=".75"/>',
    yaz: '<rect class="sky" x="0" y="0" width="120" height="60" fill="#FFF3D6"/><path d="M0 50 C30 46 70 52 120 47 V60 H0 Z" fill="#9DD6E8"/>' +
      '<g class="sun"><circle cx="92" cy="20" r="9" fill="#FFC53D"/>' + [0, 45, 90, 135, 180, 225, 270, 315].map(function (a) { return '<path d="M92 6 V2" stroke="#F2A93B" stroke-width="2" stroke-linecap="round" transform="rotate(' + a + ' 92 20)"/>'; }).join('') + '</g>' +
      '<path class="wave" d="M0 52 q10 -4 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0" fill="none" stroke="#fff" stroke-width="1.6" opacity=".8"/>',
    guz: '<rect class="sky" x="0" y="0" width="120" height="60" fill="#FBEBD8"/><path d="M0 52 C30 47 70 52 120 48 V60 H0 Z" fill="#E7C08F"/>' +
      '<path d="M96 52 V26" stroke="#8E6638" stroke-width="3"/><circle cx="96" cy="22" r="11" fill="#D9472B" opacity=".85"/><circle cx="88" cy="28" r="7" fill="#F2A93B" opacity=".9"/>' +
      [12, 34, 56, 70].map(function (x, i) { return '<path class="leaf" d="M' + x + ' -6 c4 -3 8 0 6 5 c-5 2 -8 -1 -6 -5 Z" fill="' + ['#D9472B', '#F2A93B', '#B4511F', '#E7B07A'][i] + '" style="--dl:' + (i * 0.9) + 's;--dx:' + (i % 2 ? 14 : -10) + 'px"/>'; }).join('')
  };
  var NAME = { kis: 'kış', bahar: 'bahar', yaz: 'yaz', guz: 'sonbahar' };
  var win = D.createElement('div'); win.className = 'tk-win'; win.setAttribute('aria-hidden', 'true');
  var head = wall.querySelector('.wall-h'), todayBtn = head && head.querySelector('[data-today]');
  if (head) head.insertBefore(win, todayBtn || null);
  var curSeason = '';
  var paintSeason = function () {
    var t = (monthT.textContent || '').trim().toLocaleLowerCase('tr'), m = MONTHS.findIndex(function (n) { return t.indexOf(n) === 0; });
    if (m < 0) return;
    var s = season(m); if (s === curSeason) return; curSeason = s;
    win.className = 'tk-win tk-' + s;
    win.innerHTML = '<svg viewBox="0 0 120 60" preserveAspectRatio="xMidYMid slice">' + SCENE[s] + '</svg><span>' + NAME[s] + '</span>';
  };

  /* ---------- süsleme: her takvim çiziminden sonra ---------- */
  var RING = '<svg class="tk-today" viewBox="0 0 54 44" aria-hidden="true"><path pathLength="100" d="M38 6 C26 0 6 4 5 21 C4 37 26 42 40 35 C52 29 50 10 32 6"/></svg><i class="tk-tl" aria-hidden="true">bugün</i>';
  var busy = false, lastMonth = '';
  var decorate = function () {
    if (busy) return; busy = true;
    try {
      var now = new Date(), tk = ymd(now), wd = (now.getDay() + 6) % 7, ws = new Date(now); ws.setDate(now.getDate() - wd);
      var wsK = ymd(ws), we = new Date(ws); we.setDate(ws.getDate() + 6); var weK = ymd(we);
      var flipped = monthT.textContent !== lastMonth && lastMonth !== ''; lastMonth = monthT.textContent;
      Array.prototype.forEach.call(days.querySelectorAll('.day[data-d]'), function (c) {
        var k = c.getAttribute('data-d');
        c.classList.toggle('tk-past', k < tk); c.classList.toggle('tk-week', k >= wsK && k <= weK);
        if (k === tk && !c.querySelector('.tk-today')) c.insertAdjacentHTML('beforeend', RING);
        if (c.classList.contains('exam') && !c.querySelector('.tk-cd') && k >= tk) {
          var n = Math.round((toD(k) - toD(tk)) / 86400000);
          c.insertAdjacentHTML('beforeend', '<i class="tk-cd" aria-hidden="true">' + (n === 0 ? 'bugün!' : n === 1 ? 'yarın' : n + ' gün') + '</i>');
        }
      });
      Array.prototype.forEach.call(days.querySelectorAll('.pi'), function (p, i) {
        if (p.querySelector('.tk-dec')) return;
        var t = p.classList.contains('odev') ? '<i class="tk-dec tk-tape" aria-hidden="true"></i>' : p.classList.contains('calisma') ? '<i class="tk-dec tk-clip" aria-hidden="true"></i>' : '<i class="tk-dec" aria-hidden="true"></i>';
        if (p.classList.contains('done')) t += '<i class="tk-ok" aria-hidden="true">tamam ✓</i>';
        p.insertAdjacentHTML('beforeend', t);
        if (flipped && !RM) { p.classList.add('tk-in'); p.style.setProperty('--di', (i * 0.05).toFixed(2) + 's'); setTimeout(function () { p.classList.remove('tk-in'); }, 1100 + i * 50); }
      });
      if (flipped && !RM) { wall.classList.remove('tk-sway'); void wall.offsetWidth; wall.classList.add('tk-sway'); setTimeout(function () { wall.classList.remove('tk-sway'); }, 900); }
      paintSeason();
    } finally { busy = false; }
  };
  if ('MutationObserver' in W) {
    new MutationObserver(function () { if (!busy) decorate(); }).observe(days, { childList: true });
    new MutationObserver(paintSeason).observe(monthT, { childList: true, characterData: true, subtree: true });
  }
  lastMonth = monthT.textContent;
  decorate();
  /* gece yarısı geçince "bugün" yer değiştirsin */
  setInterval(function () { var t = days.querySelector('.tk-today'), c = t && t.closest('.day'); if (c && c.getAttribute('data-d') !== ymd(new Date())) { Array.prototype.forEach.call(days.querySelectorAll('.tk-today,.tk-tl'), function (x) { x.remove(); }); decorate(); } }, 60000);
  W.AXTakvim = { decorate: decorate, season: season };
})();
