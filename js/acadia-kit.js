/* ==========================================================================
   ACADIA KİTİ (js/acadia-kit.js + css/acadia-kit.css), 28.10.2026
   Acadex'in maskotu Acadia'yı tek kaynaktan çizer: landing, her panel, sağ alttaki
   düğme ve stüdyo aynı fonksiyonu kullanır.

     AcadiaKit.svg({ mood, pose, size, costume, flip, cls })  -> SVG metni
     <span data-acadia data-mood="mutlu" data-pose="selam" data-size="96"
           data-costume="medlab" data-say="..."></span>       -> kendiliğinden çizilir
     AcadiaKit.react(elOrSelector, mood, ms)                 -> kısa süre ifade değiştir
     AcadiaKit.say(elOrSelector, text, ms)                   -> konuşma balonu
     AcadiaKit.openStudio()                                  -> "Acadia'nı giydir"

   Kişiselleştirme (renk, baş / göz / boyun aksesuarı, varsayılan ifade, panel kılıkları)
   Supabase oturumunun user_metadata.acadia alanında saklanır; veritabanı sütunu gerekmez.
   İlk boyama için tarayıcıda da önbelleğe alınır (acadex.acadia.style).
   Hareketler prefers-reduced-motion'da durur.
   ========================================================================== */
(function () {
  'use strict';
  if (window.AcadiaKit) return;
  var D = document, W = window;
  var INK = '#1A2A5C';
  var calm = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };
  var X = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* ---------- seçenekler ---------- */
  var COLORS = {
    sari: { ad: 'güneş', f: '#FFD86B', ck: '#F29C94' },
    seftali: { ad: 'şeftali', f: '#FFC59E', ck: '#E8806E' },
    mercan: { ad: 'mercan', f: '#FF9C8A', ck: '#D9534A' },
    pembe: { ad: 'pembe', f: '#FFB8D6', ck: '#E0648A' },
    lavanta: { ad: 'lavanta', f: '#C9B8FF', ck: '#F29C94' },
    gok: { ad: 'gök', f: '#9CCBFF', ck: '#F29C94' },
    nane: { ad: 'nane', f: '#93E4C4', ck: '#F29C94' },
    gece: { ad: 'gece', f: '#3E4F8F', ck: '#FF9CB0', eye: '#FFFDF4', glow: true }
  };
  var SLOTS = {
    bas: [['', 'yok'], ['kep', 'mezuniyet kepi'], ['tac', 'taç'], ['kulaklik', 'kulaklık'], ['bere', 'bere']],
    goz: [['', 'yok'], ['gozluk', 'gözlük'], ['gunes', 'güneş gözlüğü'], ['deney', 'deney gözlüğü']],
    boyun: [['', 'yok'], ['atki', 'atkı'], ['papyon', 'papyon'], ['stetoskop', 'stetoskop']]
  };
  var MOODS = [['mutlu', 'mutlu'], ['dusunuyor', 'düşünüyor'], ['saskin', 'şaşkın'], ['uykulu', 'uykulu'], ['kutlama', 'kutlama'], ['uzgun', 'üzgün'], ['odakli', 'odaklı'], ['kirp', 'göz kırpar']];
  var POSES = ['dur', 'selam', 'isaret', 'oku', 'zipla', 'dusun'];
  /* panel kılıkları: kullanıcı "panellere göre kılık" açıksa o yuvayı geçici olarak doldurur */
  var COSTUMES = { medlab: { boyun: 'stetoskop' }, studylab: { goz: 'deney' }, kartoteks: { goz: 'gozluk' }, sinav: { bas: 'kep' }, kutlama: { bas: 'tac' } };
  var DEF = { renk: 'sari', bas: '', goz: '', boyun: '', ifade: 'mutlu', kostum: true };
  var KEY = 'acadex.acadia.style';

  var clean = function (s) {
    s = s && typeof s === 'object' ? s : {}; var o = {};
    o.renk = COLORS[s.renk] ? s.renk : DEF.renk;
    ['bas', 'goz', 'boyun'].forEach(function (k) { o[k] = SLOTS[k].some(function (x) { return x[0] === s[k]; }) ? s[k] : ''; });
    o.ifade = MOODS.some(function (m) { return m[0] === s.ifade; }) ? s.ifade : DEF.ifade;
    o.kostum = s.kostum !== false;
    return o;
  };
  var STYLE = clean(lsafe(function () { return JSON.parse(localStorage.getItem(KEY) || 'null'); }, null));

  /* ---------- çizim ---------- */
  var STAR = 'M0 -50 C6 -18 18 -6 50 0 C18 6 6 18 0 50 C-6 18 -18 6 -50 0 C-18 -6 -6 -18 0 -50 Z';
  var eyeOpen = function (x, c, big) {
    var rx = big ? 7.6 : 6.5, ry = big ? 9.4 : 8, pr = big ? 3 : 3.6;
    return '<g class="ey" transform="translate(' + x + ' -4)" style="--t:translate(' + x + 'px,-4px)"><ellipse class="w" rx="' + rx + '" ry="' + ry + '" style="fill:' + (c.eye || '#fff') + ';stroke:' + INK + '"/><circle class="pu" r="' + pr + '" style="fill:' + INK + '"/><circle class="gl" cx="1.4" cy="-2.2" r="1.2" style="fill:#fff"/></g>';
  };
  var arc = function (x, up) { return '<path class="ea" d="' + (up ? 'M' + (x - 5.5) + ' -2 Q' + x + ' -10 ' + (x + 5.5) + ' -2' : 'M' + (x - 5.5) + ' -5 Q' + x + ' 1 ' + (x + 5.5) + ' -5') + '" style="fill:none;stroke:' + INK + ';stroke-width:2.6;stroke-linecap:round"/>'; };
  var face = function (m, c) {
    var e = '', mo = '', br = '', lid = '';
    var stroke = 'fill:none;stroke:' + INK + ';stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round';
    switch (m) {
      case 'uykulu': e = arc(-10, false) + arc(10, false); mo = '<path class="mo" d="M-3 12 Q0 15 3 12" style="' + stroke + '"/>'; break;
      case 'kutlama': e = arc(-10, true) + arc(10, true); mo = '<path class="mo mo-f" d="M-8 9 Q0 22 8 9 Z" style="fill:' + INK + ';stroke:' + INK + ';stroke-width:2;stroke-linejoin:round"/><path d="M-4 15 Q0 18 4 15" style="fill:#E0645A"/>'; break;
      case 'kirp': e = arc(-10, true) + eyeOpen(10, c); mo = '<path class="mo" d="M-6 10 Q1 16 7 9" style="' + stroke + '"/>'; break;
      case 'saskin': e = eyeOpen(-10, c, true) + eyeOpen(10, c, true); mo = '<ellipse class="mo" cx="0" cy="14" rx="3.2" ry="4.2" style="fill:' + INK + '"/>'; br = '<path d="M-16 -17 Q-10 -21 -4 -17 M4 -17 Q10 -21 16 -17" style="' + stroke + ';stroke-width:2"/>'; break;
      case 'uzgun': e = eyeOpen(-10, c) + eyeOpen(10, c); mo = '<path class="mo" d="M-6 14 Q0 8 6 14" style="' + stroke + '"/>'; br = '<path d="M-16 -13 L-5 -16 M5 -16 L16 -13" style="' + stroke + ';stroke-width:2"/>'; break;
      case 'odakli': e = eyeOpen(-10, c) + eyeOpen(10, c); lid = '<path d="M-17 -6 Q-10 -15 -3 -6 Z M3 -6 Q10 -15 17 -6 Z" style="fill:' + c.f + ';stroke:' + INK + ';stroke-width:2"/>'; mo = '<path class="mo" d="M-5 12 H5" style="' + stroke + '"/>'; br = '<path d="M-16 -16 L-5 -13 M5 -13 L16 -16" style="' + stroke + ';stroke-width:2"/>'; break;
      case 'dusunuyor': e = eyeOpen(-10, c) + eyeOpen(10, c); mo = '<path class="mo" d="M-4 12 Q0 10 5 12" style="' + stroke + '"/>'; br = '<path d="M4 -17 Q10 -21 16 -16" style="' + stroke + ';stroke-width:2"/>'; break;
      default: e = eyeOpen(-10, c) + eyeOpen(10, c); mo = '<path class="mo" d="M-6 10 Q0 16 6 10" style="' + stroke + '"/>';
    }
    return '<ellipse class="ck" cx="-17" cy="10" rx="6" ry="3.5" style="fill:' + c.ck + '"/><ellipse class="ck" cx="17" cy="10" rx="6" ry="3.5" style="fill:' + c.ck + '"/>' +
      '<g class="eyes' + (m === 'dusunuyor' ? ' look-up' : '') + '">' + e + '</g>' + lid + br + mo;
  };
  var hand = function (x, y, c) { return '<circle cx="' + x + '" cy="' + y + '" r="5.2" style="fill:' + c.f + ';stroke:' + INK + ';stroke-width:2.4"/>'; };
  var arm = function (d) { return '<path d="' + d + '" style="fill:none;stroke:' + INK + ';stroke-width:2.6;stroke-linecap:round"/>'; };
  var poseBack = function (p, c) {
    if (p === 'zipla') return '<g class="acd-arms">' + arm('M-34 -6 Q-44 -20 -42 -34') + hand(-42, -36, c) + arm('M34 -6 Q44 -20 42 -34') + hand(42, -36, c) + '</g>';
    return '';
  };
  var poseFront = function (p, c) {
    switch (p) {
      case 'selam': return '<g class="acd-wave">' + arm('M38 -4 Q50 -10 52 -22') + hand(53, -25, c) + '</g>';
      case 'isaret': return '<g class="acd-point">' + arm('M40 2 Q54 2 62 -2') + '<path d="M60 -6 L74 -6" style="stroke:' + INK + ';stroke-width:2.6;stroke-linecap:round"/>' + hand(62, -3, c) + '</g>';
      case 'oku': return '<g class="acd-book"><path d="M-24 22 L0 26 L24 22 L24 40 L0 44 L-24 40 Z" style="fill:#2F6BFF;stroke:' + INK + ';stroke-width:2.4;stroke-linejoin:round"/><path d="M-21 21 Q-10 18 0 24 Q10 18 21 21 L21 37 Q10 34 0 40 Q-10 34 -21 37 Z" style="fill:#FFFDF4;stroke:' + INK + ';stroke-width:2;stroke-linejoin:round"/><path d="M-16 26 H-5 M-16 30 H-6 M5 26 H16 M6 30 H16" style="stroke:#9AA6C0;stroke-width:1.4"/>' + hand(-24, 30, c) + hand(24, 30, c) + '</g>';
      case 'dusun': return '<g class="acd-chin">' + arm('M30 6 Q26 22 14 24') + hand(12, 24, c) + '</g>';
      default: return '';
    }
  };
  var acc = {
    kep: '<g class="acc acc-bas"><path d="M-15 -46 V-37 Q0 -31 15 -37 V-46" style="fill:' + INK + '"/><path d="M0 -63 L32 -52 L0 -41 L-32 -52 Z" style="fill:' + INK + ';stroke:' + INK + ';stroke-width:2;stroke-linejoin:round"/><path d="M0 -52 L24 -47 V-33" style="fill:none;stroke:#FFC93C;stroke-width:2"/><circle cx="24" cy="-31" r="3" style="fill:#FFC93C"/></g>',
    tac: '<g class="acc acc-bas"><path d="M-15 -42 L-17 -62 L-7 -53 L0 -67 L7 -53 L17 -62 L15 -42 Q0 -38 -15 -42 Z" style="fill:#FFC93C;stroke:' + INK + ';stroke-width:2.4;stroke-linejoin:round"/><circle cx="0" cy="-49" r="2.6" style="fill:#D9485F"/><circle cx="-9" cy="-47" r="1.8" style="fill:#2F6BFF"/><circle cx="9" cy="-47" r="1.8" style="fill:#2F6BFF"/></g>',
    kulaklik: '<g class="acc acc-bas"><path d="M-31 -6 C-33 -54 33 -54 31 -6" style="fill:none;stroke:' + INK + ';stroke-width:5;stroke-linecap:round"/><rect x="-39" y="-15" width="13" height="20" rx="5" style="fill:#2F6BFF;stroke:' + INK + ';stroke-width:2.4"/><rect x="26" y="-15" width="13" height="20" rx="5" style="fill:#2F6BFF;stroke:' + INK + ';stroke-width:2.4"/></g>',
    bere: '<g class="acc acc-bas"><path d="M-17 -38 C-19 -64 19 -64 17 -38 Z" style="fill:#E0645A;stroke:' + INK + ';stroke-width:2.4;stroke-linejoin:round"/><path d="M-9 -58 V-42 M0 -61 V-42 M9 -58 V-42" style="stroke:#C24B43;stroke-width:1.6"/><rect x="-20" y="-44" width="40" height="9" rx="4.5" style="fill:#C24B43;stroke:' + INK + ';stroke-width:2.2"/><circle cx="0" cy="-65" r="5.5" style="fill:#FFFDF4;stroke:' + INK + ';stroke-width:2"/></g>',
    gozluk: '<g class="acc acc-goz"><circle cx="-10" cy="-4" r="9.6" style="fill:rgba(255,255,255,.18);stroke:' + INK + ';stroke-width:2.4"/><circle cx="10" cy="-4" r="9.6" style="fill:rgba(255,255,255,.18);stroke:' + INK + ';stroke-width:2.4"/><path d="M-1 -6 Q0 -8 1 -6 M-19.6 -6 L-26 -9 M19.6 -6 L26 -9" style="fill:none;stroke:' + INK + ';stroke-width:2.2;stroke-linecap:round"/></g>',
    gunes: '<g class="acc acc-goz"><path d="M-21 -11 H-1 V-4 Q-1 6 -11 6 Q-21 6 -21 -4 Z M1 -11 H21 V-4 Q21 6 11 6 Q1 6 1 -4 Z" style="fill:' + INK + ';stroke:' + INK + ';stroke-width:2;stroke-linejoin:round"/><path d="M-1 -9 H1 M-21 -10 L-27 -12 M21 -10 L27 -12" style="stroke:' + INK + ';stroke-width:2.4;stroke-linecap:round"/><path d="M-17 -7 L-12 -7 M5 -7 L10 -7" style="stroke:#9CCBFF;stroke-width:2;stroke-linecap:round"/></g>',
    deney: '<g class="acc acc-goz"><path d="M-36 -5 H36" style="stroke:#2E8C82;stroke-width:5;stroke-linecap:round"/><rect x="-22" y="-14" width="20" height="19" rx="7" style="fill:rgba(180,232,255,.45);stroke:' + INK + ';stroke-width:2.4"/><rect x="2" y="-14" width="20" height="19" rx="7" style="fill:rgba(180,232,255,.45);stroke:' + INK + ';stroke-width:2.4"/><path d="M-17 -10 L-13 -10 M7 -10 L11 -10" style="stroke:#fff;stroke-width:2;stroke-linecap:round"/></g>',
    atki: '<g class="acc acc-boyun"><path d="M-21 15 Q0 25 21 15 L21 23 Q0 33 -21 23 Z" style="fill:#D9485F;stroke:' + INK + ';stroke-width:2.2;stroke-linejoin:round"/><path d="M7 25 L13 44 L5 45 L1 27" style="fill:#D9485F;stroke:' + INK + ';stroke-width:2.2;stroke-linejoin:round"/><path d="M-12 18 V26 M-4 20 V28 M4 20 V28 M12 18 V26 M6 35 L11 34" style="stroke:#FFFDF4;stroke-width:1.6;opacity:.8"/></g>',
    papyon: '<g class="acc acc-boyun"><path d="M0 25 L-13 17 L-13 33 Z M0 25 L13 17 L13 33 Z" style="fill:#2F6BFF;stroke:' + INK + ';stroke-width:2.2;stroke-linejoin:round"/><circle cx="0" cy="25" r="3.4" style="fill:#2F6BFF;stroke:' + INK + ';stroke-width:2"/></g>',
    stetoskop: '<g class="acc acc-boyun"><path d="M-17 12 C-20 30 -8 37 0 37 C8 37 20 30 17 12" style="fill:none;stroke:' + INK + ';stroke-width:2.6;stroke-linecap:round"/><path d="M0 37 V45" style="stroke:' + INK + ';stroke-width:2.6"/><circle cx="0" cy="49" r="5" style="fill:#C8D3DC;stroke:' + INK + ';stroke-width:2.4"/><circle cx="-17" cy="11" r="2.4" style="fill:#97A6B4"/><circle cx="17" cy="11" r="2.4" style="fill:#97A6B4"/></g>'
  };
  var fx = function (m, p) {
    if (m === 'kutlama' || p === 'zipla') return '<g class="acd-fx acd-spark"><path d="M-52 -40 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2 Z" style="fill:#FFC93C;stroke:' + INK + ';stroke-width:1.4"/><path d="M50 -48 l1.6 4.4 4.4 1.6 -4.4 1.6 -1.6 4.4 -1.6 -4.4 -4.4 -1.6 4.4 -1.6 Z" style="fill:#FF9C8A;stroke:' + INK + ';stroke-width:1.2"/><circle cx="-58" cy="-10" r="2.4" style="fill:#2F6BFF"/><circle cx="58" cy="-14" r="2" style="fill:#2E9E6B"/></g>';
    if (m === 'uykulu') return '<g class="acd-fx acd-z"><text x="30" y="-34" style="font:700 14px \'Caveat\',cursive;fill:' + INK + '">z</text><text x="40" y="-46" style="font:700 18px \'Caveat\',cursive;fill:' + INK + '">z</text></g>';
    if (m === 'dusunuyor' || p === 'dusun') return '<g class="acd-fx acd-dots"><circle cx="34" cy="-38" r="2.6" style="fill:' + INK + '"/><circle cx="42" cy="-48" r="3.4" style="fill:' + INK + '"/><circle cx="52" cy="-60" r="4.4" style="fill:' + INK + '"/></g>';
    return '';
  };
  var resolve = function (o) {
    var st = STYLE, out = { renk: o.renk || st.renk, bas: st.bas, goz: st.goz, boyun: st.boyun };
    if (o.bas != null) out.bas = o.bas; if (o.goz != null) out.goz = o.goz; if (o.boyun != null) out.boyun = o.boyun;
    var cs = o.costume && COSTUMES[o.costume];
    if (cs && (o.forceCostume || st.kostum)) Object.keys(cs).forEach(function (k) { out[k] = cs[k]; });
    return out;
  };
  /* o: { mood, pose, size, costume, flip, cls, renk/bas/goz/boyun (önizleme için) } */
  var svg = function (o) {
    o = o || {};
    var r = resolve(o), c = COLORS[r.renk] || COLORS.sari;
    var m = o.mood || STYLE.ifade || 'mutlu', p = POSES.indexOf(o.pose) > -1 ? o.pose : 'dur';
    var sz = o.size ? ' width="' + o.size + '" height="' + Math.round(o.size * 1.05) + '"' : '';
    return '<svg class="acd acd-m-' + m + ' acd-p-' + p + (c.glow ? ' acd-glow' : '') + (o.cls ? ' ' + o.cls : '') + '" viewBox="-76 -80 152 160"' + sz + ' aria-hidden="true" focusable="false">' +
      '<g class="bd' + (o.flip ? ' acd-flip' : '') + '">' + poseBack(p, c) +
      '<path class="st" d="' + STAR + '" style="fill:' + c.f + ';stroke:' + INK + ';stroke-width:3.6;stroke-linejoin:round"/>' +
      face(m, c) + (r.goz ? acc[r.goz] || '' : '') + (r.boyun ? acc[r.boyun] || '' : '') + (r.bas ? acc[r.bas] || '' : '') +
      poseFront(p, c) + '</g>' + fx(m, p) + '</svg>';
  };

  /* ---------- yerleştirme: [data-acadia] ---------- */
  var paint = function (el) {
    var d = el.dataset, old = el.querySelector('svg.acd');
    el.classList.add('acd-host');
    var html = svg({ mood: d.moodNow || d.mood, pose: d.pose, size: +d.size || 0, costume: d.costume, flip: d.flip === '' || d.flip === 'true' });
    if (old) { old.insertAdjacentHTML('afterend', html); old.remove(); } else el.insertAdjacentHTML('afterbegin', html); /* balon yerinde kalır */
    if (d.say && !el.__said) { el.__said = true; say(el, d.say, +d.sayMs || 0); }
  };
  var mountAll = function (root) { Array.prototype.forEach.call((root || D).querySelectorAll('[data-acadia]'), function (el) { if (!el.__acd || el.__acdV !== ver) { el.__acd = true; el.__acdV = ver; paint(el); } }); };
  var ver = 1;
  var repaintAll = function () { ver++; mountAll(); D.dispatchEvent(new CustomEvent('acadia:style', { detail: STYLE })); };
  var $el = function (x) { return typeof x === 'string' ? D.querySelector(x) : x; };
  var react = function (x, mood, ms) {
    var el = $el(x); if (!el || !el.dataset) return;
    clearTimeout(el.__acdT); el.dataset.moodNow = mood; paint(el); if (!calm) { el.classList.remove('acd-hop'); void el.offsetWidth; el.classList.add('acd-hop'); }
    if (ms !== 0) el.__acdT = setTimeout(function () { delete el.dataset.moodNow; paint(el); }, ms || 1400);
  };
  var setMood = function (x, mood) { var el = $el(x); if (!el) return; clearTimeout(el.__acdT); if (mood) el.dataset.moodNow = mood; else delete el.dataset.moodNow; paint(el); };
  var say = function (x, text, ms) {
    var el = $el(x); if (!el) return;
    var b = el.querySelector('.acd-say'); if (!b) { b = D.createElement('span'); b.className = 'acd-say'; b.setAttribute('role', 'status'); el.appendChild(b); }
    b.textContent = text; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    clearTimeout(b.__t); if (ms) b.__t = setTimeout(function () { b.classList.remove('on'); }, ms);
  };

  /* gözler imleci izler (yalnız ekranda görünenler) */
  if (!calm) {
    var mx = -1, my = -1, raf = 0;
    D.addEventListener('pointermove', function (e) {
      mx = e.clientX; my = e.clientY; if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        Array.prototype.forEach.call(D.querySelectorAll('.acd-host svg.acd'), function (s) {
          var r = s.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) return;
          var dx = mx - (r.left + r.width / 2), dy = my - (r.top + r.height / 2), dd = Math.sqrt(dx * dx + dy * dy) || 1, k = Math.min(2.4, dd / 60);
          Array.prototype.forEach.call(s.querySelectorAll('.pu, .gl'), function (p) { p.style.transform = 'translate(' + (dx / dd * k).toFixed(2) + 'px,' + (dy / dd * k * 1.2).toFixed(2) + 'px)'; });
        });
      });
    }, { passive: true });
  }

  /* ---------- kayıt: user_metadata.acadia ---------- */
  var sbc = function () { return typeof supabaseClient !== 'undefined' ? supabaseClient : (W.supabaseClient || null); };
  var cache = function () { lsafe(function () { localStorage.setItem(KEY, JSON.stringify(STYLE)); }); };
  var loadRemote = function () {
    var c = sbc(); if (!c || !c.auth || !c.auth.getUser) return;
    lsafe(function () {
      c.auth.getUser().then(function (r) {
        var u = r && r.data && r.data.user, a = u && u.user_metadata && u.user_metadata.acadia; if (!a) return;
        var n = clean(a); if (JSON.stringify(n) === JSON.stringify(STYLE)) return;
        STYLE = n; cache(); repaintAll();
      }).catch(function () {});
    });
  };
  var save = function (s) {
    STYLE = clean(s); cache(); repaintAll();
    var c = sbc(); if (!c || !c.auth || !c.auth.updateUser) return Promise.resolve({ local: true });
    return c.auth.updateUser({ data: { acadia: STYLE } }).then(function (r) { if (r && r.error) throw r.error; return r; });
  };

  /* ---------- stüdyo: "Acadia'nı giydir" ---------- */
  var studio = null;
  var openStudio = function () {
    var draft = clean(STYLE), prevMood = 'mutlu', prevPose = 'selam';
    if (!studio) {
      studio = D.createElement('dialog'); studio.className = 'acd-studio'; studio.setAttribute('aria-labelledby', 'acd-st-t');
      D.body.appendChild(studio);
      studio.addEventListener('cancel', function () { studio.close(); });
    }
    var opt = function (slot, val, label, on) { return '<button type="button" class="acd-opt' + (on ? ' on' : '') + '" data-slot="' + slot + '" data-val="' + val + '" aria-pressed="' + on + '" title="' + X(label) + '">' + (slot === 'renk' ? '<i style="background:' + COLORS[val].f + '"></i>' : '<span class="acd-mini">' + svg(Object.assign({ mood: 'mutlu', renk: draft.renk, bas: '', goz: '', boyun: '' }, slot ? (function () { var x = {}; x[slot] = val; return x; })() : {})) + '</span>') + '<b>' + X(label) + '</b></button>'; };
    var render = function () {
      studio.innerHTML = '<form method="dialog" class="acd-st-f">' +
        '<header><span class="hand">maskot stüdyosu</span><h2 id="acd-st-t" class="disp">Acadia’nı giydir</h2><p>seçtiklerin her yerde görünür: sağ altta, panellerde ve sohbette.</p></header>' +
        '<div class="acd-st-grid"><div class="acd-st-prev"><div class="acd-st-stage" data-st-stage="">' + svg({ mood: prevMood, pose: prevPose, renk: draft.renk, bas: draft.bas, goz: draft.goz, boyun: draft.boyun }) + '</div>' +
        '<div class="acd-st-moods" role="group" aria-label="İfadeyi dene">' + MOODS.map(function (m) { return '<button type="button" data-try="' + m[0] + '" aria-pressed="' + (m[0] === prevMood) + '">' + X(m[1]) + '</button>'; }).join('') + '</div>' +
        '<div class="acd-st-moods" role="group" aria-label="Pozu dene">' + [['selam', 'el sallar'], ['isaret', 'gösterir'], ['oku', 'okur'], ['zipla', 'zıplar'], ['dusun', 'düşünür'], ['dur', 'durur']].map(function (p) { return '<button type="button" data-pose="' + p[0] + '" aria-pressed="' + (p[0] === prevPose) + '">' + X(p[1]) + '</button>'; }).join('') + '</div></div>' +
        '<div class="acd-st-opts">' +
        '<fieldset><legend>renk</legend><div class="acd-row">' + Object.keys(COLORS).map(function (k) { return opt('renk', k, COLORS[k].ad, draft.renk === k); }).join('') + '</div></fieldset>' +
        '<fieldset><legend>baş</legend><div class="acd-row">' + SLOTS.bas.map(function (x) { return opt('bas', x[0], x[1], draft.bas === x[0]); }).join('') + '</div></fieldset>' +
        '<fieldset><legend>göz</legend><div class="acd-row">' + SLOTS.goz.map(function (x) { return opt('goz', x[0], x[1], draft.goz === x[0]); }).join('') + '</div></fieldset>' +
        '<fieldset><legend>boyun</legend><div class="acd-row">' + SLOTS.boyun.map(function (x) { return opt('boyun', x[0], x[1], draft.boyun === x[0]); }).join('') + '</div></fieldset>' +
        '<fieldset><legend>varsayılan ifade</legend><div class="acd-row acd-row-t">' + MOODS.map(function (m) { return '<button type="button" class="acd-opt acd-t' + (draft.ifade === m[0] ? ' on' : '') + '" data-slot="ifade" data-val="' + m[0] + '" aria-pressed="' + (draft.ifade === m[0]) + '"><b>' + X(m[1]) + '</b></button>'; }).join('') + '</div></fieldset>' +
        '<label class="acd-chk"><input type="checkbox" data-kostum=""' + (draft.kostum ? ' checked' : '') + '> panellere göre kılık değiştirsin <small>MedLab’de stetoskop, Study Lab’de deney gözlüğü, Kartoteks’te gözlük</small></label>' +
        '</div></div>' +
        '<p class="acd-st-msg" data-st-msg="" role="status"></p>' +
        '<footer><button type="button" class="acd-b ghost" data-reset="">varsayılana dön</button><span></span><button type="button" class="acd-b ghost" data-cancel="">vazgeç</button><button type="submit" class="acd-b pri">kaydet</button></footer></form>';
    };
    render();
    studio.onclick = function (e) {
      var t = e.target.closest('button, input'); if (!t) return;
      if (t.hasAttribute('data-try')) { prevMood = t.getAttribute('data-try'); render(); return; }
      if (t.hasAttribute('data-pose')) { prevPose = t.getAttribute('data-pose'); render(); return; }
      if (t.hasAttribute('data-slot')) { draft[t.getAttribute('data-slot')] = t.getAttribute('data-val'); if (t.getAttribute('data-slot') === 'ifade') prevMood = draft.ifade; render(); var f = studio.querySelector('[data-slot="' + t.getAttribute('data-slot') + '"][data-val="' + t.getAttribute('data-val') + '"]'); if (f) f.focus(); return; }
      if (t.hasAttribute('data-kostum')) { draft.kostum = t.checked; return; }
      if (t.hasAttribute('data-reset')) { draft = clean(DEF); render(); return; }
      if (t.hasAttribute('data-cancel')) { studio.close(); }
    };
    studio.onsubmit = function (e) {
      e.preventDefault(); var msg = studio.querySelector('[data-st-msg]'), sub = studio.querySelector('button[type="submit"]');
      sub.disabled = true; msg.textContent = 'kaydediyorum…';
      save(draft).then(function () { studio.close(); var mas = D.querySelector('#axa-layer .axa-mas'); if (mas) react(mas, 'kutlama', 1600); })
        .catch(function () { sub.disabled = false; msg.textContent = 'hesabına kaydedemedim; bu cihazda kullanılacak. bağlantını kontrol edip tekrar dene.'; });
    };
    if (typeof studio.showModal === 'function') studio.showModal(); else studio.setAttribute('open', '');
  };
  D.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-acd-studio]'); if (b) { e.preventDefault(); openStudio(); } });

  W.AcadiaKit = { svg: svg, mount: mountAll, react: react, setMood: setMood, say: say, openStudio: openStudio, save: save, get style() { return clean(STYLE); }, COLORS: COLORS, SLOTS: SLOTS, MOODS: MOODS, POSES: POSES, COSTUMES: COSTUMES, clean: clean };

  var boot = function () {
    mountAll();
    var q = 0; if (W.MutationObserver) new MutationObserver(function () { if (q) return; q = requestAnimationFrame(function () { q = 0; mountAll(); }); }).observe(D.body, { childList: true, subtree: true });
    loadRemote(); setTimeout(loadRemote, 2500);
  };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot); else boot();
})();
