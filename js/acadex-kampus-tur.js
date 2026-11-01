/* ==========================================================================
   LANDING · ACADEX MEDLAB SAĞLIK KAMPÜSÜ TURU (js/acadex-kampus-tur.js), 01.11.2026
   index.html → section#medlab.kt. Acadex Medica'nın maskeli rehber cerrahı (Op. Dr. Kaan
   Arslan) scroll'la kampüs yolunda yürür; her lab binasının önünde o lab'ın maskotu kendi
   animasyonunu yapar (kapaklar dashboard'daki MedLab kartlarıyla aynı; maskot hareketleri
   css/acadex-kampus-tur-maskot.css). Son durakta Acadex Medica'nın kapısı açılır.
     - Sahne ekrana sabitlenir; uzak tepeler, binalar ve ön plan farklı hızda kayar.
     - Cerrah yalnız scroll sırasında yürür; yukarı kaydırınca döner.
     - "Bölümün ne?" çipleri o bölümün durağına götürür, durağa "senin bölümün" rozeti koyar.
     - Acadia rehberi (js/acadia-rehber.js) her durakta tek cümleyle eşlik eder.
     - Kısa mod: hareket azaltma tercihinde, dar ekranda ya da JS yokken sabitleme olmaz;
       duraklar maskotlu kartlar olarak alt alta durur (HTML'in varsayılan hâli).
   ========================================================================== */
(function () {
  'use strict';
  var D = document, W = window;
  var sec = D.querySelector('[data-kt]'); if (!sec) return;
  var track = sec.querySelector('.kt-track'), stage = sec.querySelector('.kt-stage');
  var sts = Array.prototype.slice.call(sec.querySelectorAll('.kt-st'));
  var rail = sec.querySelector('.kt-rail'), n = sts.length;
  var calm = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };

  /* ---------------- bölüm seçici (her iki modda) ---------------- */
  var KEY = 'acadex.kt.bolum';
  var mark = function (id) {
    sts.forEach(function (s) { s.classList.toggle('kt-sen', !!id && s.getAttribute('data-st') === id); });
    Array.prototype.forEach.call(sec.querySelectorAll('[data-kt-bolum]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-kt-bolum') === id)); });
  };
  var pinned = false;
  var goStation = function (i, smooth) {
    if (i < 0) return;
    if (pinned) {
      var top = track.getBoundingClientRect().top + W.scrollY, len = track.offsetHeight - W.innerHeight;
      W.scrollTo({ top: top + (n > 1 ? i / (n - 1) : 0) * len + 2, behavior: smooth && !calm ? 'smooth' : 'auto' });
    } else if (sts[i]) {
      sts[i].scrollIntoView({ behavior: smooth && !calm ? 'smooth' : 'auto', block: 'center' });
    }
  };
  sec.addEventListener('click', function (e) {
    var b = e.target.closest('[data-kt-bolum]');
    if (b) {
      var id = b.getAttribute('data-kt-bolum'); lsafe(function () { localStorage.setItem(KEY, id); });
      mark(id === 'hepsi' ? null : id);
      var i = id === 'hepsi' ? 0 : sts.findIndex(function (s) { return s.getAttribute('data-st') === id; });
      goStation(i, true);
      return;
    }
    var r = e.target.closest('[data-kt-git]');
    if (r) { e.preventDefault(); goStation(+r.getAttribute('data-kt-git'), true); }
  });
  var saved = lsafe(function () { return localStorage.getItem(KEY); }, null);
  if (saved && saved !== 'hepsi') mark(saved);

  /* ---------------- sabitlenmiş tur ---------------- */
  var wantPin = function () { return !calm && W.innerWidth >= 760 && W.innerHeight >= 520; };
  if (!wantPin()) return;   /* kısa mod: HTML olduğu gibi kalır */
  pinned = true;
  sec.classList.add('kt-pin');
  track.style.setProperty('--kt-n', n);

  /* dünya: uzak tepeler, binalar + yol, ön plan (dünya birimi: 600 yükseklik) */
  var SP = 900, X0 = 600, WW = X0 + (n - 1) * SP + 1400;
  var NS = 'http://www.w3.org/2000/svg';
  var renk = sts.map(function (s) { return s.getAttribute('data-renk') || '#2F6BFF'; });
  var ad = sts.map(function (s) { return s.getAttribute('data-ad') || ''; });
  var bina = function (i) {
    var cx = X0 + i * SP, c = renk[i], last = i === n - 1, first = i === 0, s = '';
    if (first) {   /* kampüs girişi: kemer ve tabela */
      s += '<g transform="translate(' + cx + ' 0)"><rect x="-230" y="250" width="26" height="200" rx="4" fill="#C9CFDA"/><rect x="204" y="250" width="26" height="200" rx="4" fill="#C9CFDA"/>' +
        '<path d="M-240 262 Q0 170 240 262" fill="none" stroke="#0D1838" stroke-width="16" stroke-linecap="round"/>' +
        '<rect x="-190" y="196" width="380" height="54" rx="10" fill="#0D1838"/><text x="0" y="221" text-anchor="middle" font-family="Bricolage Grotesque,system-ui,sans-serif" font-size="22" font-weight="800" fill="#fff">ACADEX MEDLAB</text>' +
        '<text x="0" y="241" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" letter-spacing="3" fill="#8FE0C9">SAĞLIK KAMPÜSÜ</text>' +
        '<g fill="#D9472B"><rect x="-8" y="140" width="16" height="44" rx="3"/><rect x="-22" y="154" width="44" height="16" rx="3"/></g></g>';
      return s;
    }
    var w = last ? 640 : 460, h = last ? 330 : 250 + (i % 3) * 30, top = 450 - h, x = cx - w / 2;
    s += '<g class="kt-b" data-b="' + i + '">';
    s += '<rect x="' + (x + 10) + '" y="' + (top + 10) + '" width="' + w + '" height="' + h + '" rx="10" fill="#0D1838" opacity=".08"/>';
    s += '<rect x="' + x + '" y="' + top + '" width="' + w + '" height="' + h + '" rx="10" fill="#FBF8F1" stroke="' + c + '" stroke-width="6"/>';
    s += '<rect x="' + x + '" y="' + top + '" width="' + w + '" height="34" rx="10" fill="' + c + '"/>';
    var cols = last ? 7 : 5, rows = Math.floor((h - 150) / 56);
    for (var r = 0; r < rows; r++) for (var k = 0; k < cols; k++) {
      var wx = x + 30 + k * ((w - 60) / cols), wy = top + 60 + r * 56;
      if (Math.abs(wx + (w - 60) / cols / 2 - cx) < 70 && r === rows - 1) continue;
      s += '<rect class="kt-wn" x="' + wx.toFixed(1) + '" y="' + wy + '" width="' + ((w - 60) / cols - 16).toFixed(1) + '" height="36" rx="4" fill="' + ((r + k + i) % 4 ? '#CFE6F7' : '#FFE7A6') + '"/>';
    }
    /* kapı */
    if (last) s += '<g class="kt-door"><rect x="' + (cx - 70) + '" y="350" width="140" height="100" fill="#BFE3D8"/><rect class="kt-dl" x="' + (cx - 70) + '" y="350" width="70" height="100" fill="#9ED0C4" stroke="#fff" stroke-width="3"/><rect class="kt-dr" x="' + cx + '" y="350" width="70" height="100" fill="#9ED0C4" stroke="#fff" stroke-width="3"/></g>' +
      '<g fill="#fff"><rect x="' + (cx - 9) + '" y="' + (top - 70) + '" width="18" height="52" rx="4"/><rect x="' + (cx - 26) + '" y="' + (top - 53) + '" width="52" height="18" rx="4"/></g><rect x="' + (cx - 34) + '" y="' + (top - 78) + '" width="68" height="68" rx="14" fill="#D9472B" opacity=".92"/><g fill="#fff"><rect x="' + (cx - 8) + '" y="' + (top - 66) + '" width="16" height="44" rx="3"/><rect x="' + (cx - 22) + '" y="' + (top - 52) + '" width="44" height="16" rx="3"/></g>';
    else s += '<rect x="' + (cx - 44) + '" y="372" width="88" height="78" rx="6" fill="' + c + '" opacity=".85"/><rect x="' + (cx - 4) + '" y="376" width="8" height="74" fill="#FBF8F1" opacity=".6"/>';
    /* tabela */
    s += '<text x="' + cx + '" y="' + (top + 23) + '" text-anchor="middle" font-family="Bricolage Grotesque,system-ui,sans-serif" font-size="' + (last ? 20 : 17) + '" font-weight="800" fill="#fff">' + ad[i].toLocaleUpperCase('tr') + '</text>';
    s += '</g>';
    /* ağaç ve lamba (binalar arası) */
    var tx = cx + SP / 2;
    if (!last) s += '<g class="kt-tree"><rect x="' + (tx - 6) + '" y="380" width="12" height="70" fill="#8A6A4A"/><circle cx="' + tx + '" cy="360" r="42" fill="#6FAE5C"/><circle cx="' + (tx - 26) + '" cy="380" r="28" fill="#5E9C4E"/><circle cx="' + (tx + 28) + '" cy="378" r="30" fill="#7DBB68"/></g>' +
      '<g><rect x="' + (tx + 120) + '" y="330" width="6" height="120" fill="#7A8AA0"/><rect x="' + (tx + 108) + '" y="322" width="30" height="12" rx="6" fill="#7A8AA0"/><circle class="kt-lamp" cx="' + (tx + 123) + '" cy="338" r="6" fill="#FFE7A6"/></g>';
    return s;
  };
  var svg = function (cls, w, inner) { return '<svg class="' + cls + '" viewBox="0 0 ' + w + ' 600" preserveAspectRatio="xMinYMax meet" aria-hidden="true" focusable="false">' + inner + '</svg>'; };
  var far = '', fw = Math.round(WW * 0.45) + 1600;
  for (var fx = -200; fx < fw; fx += 520) far += '<path d="M' + fx + ' 470 Q' + (fx + 130) + ' ' + (330 + (fx / 520 % 3) * 30) + ' ' + (fx + 260) + ' 470 T' + (fx + 520) + ' 470 Z" fill="#CFE3D6"/>';
  for (var cx2 = 300; cx2 < fw; cx2 += 760) far += '<g class="kt-cloud" style="--d:' + (18 + cx2 % 7) + 's"><ellipse cx="' + cx2 + '" cy="' + (110 + cx2 % 90) + '" rx="70" ry="22" fill="#fff"/><ellipse cx="' + (cx2 + 40) + '" cy="' + (96 + cx2 % 90) + '" rx="44" ry="24" fill="#fff"/></g>';
  var mid = '<rect x="0" y="450" width="' + WW + '" height="40" fill="#D9D4C8"/><rect x="0" y="490" width="' + WW + '" height="110" fill="#5F6B7E"/>';
  for (var lx = 40; lx < WW; lx += 140) mid += '<rect x="' + lx + '" y="542" width="70" height="6" rx="3" fill="#F3EFE6" opacity=".8"/>';
  for (var i = 0; i < n; i++) mid += bina(i);
  var near = '', nw = Math.round(WW * 1.3) + 1600;
  for (var bx = 120; bx < nw; bx += 430) near += '<g><ellipse cx="' + bx + '" cy="590" rx="90" ry="34" fill="#4F8F45"/><ellipse cx="' + (bx + 70) + '" cy="596" rx="70" ry="28" fill="#5FA052"/></g>';
  var world = D.createElement('div'); world.className = 'kt-world'; world.setAttribute('aria-hidden', 'true');
  world.innerHTML = '<div class="kt-sky"></div>' + svg('kt-far', fw, far) + svg('kt-mid', WW, mid) + svg('kt-near', nw, near);
  stage.insertBefore(world, stage.firstChild);
  var lFar = world.querySelector('.kt-far'), lMid = world.querySelector('.kt-mid'), lNear = world.querySelector('.kt-near');

  /* rehber cerrah (yandan): yeşil önlük, bone, maske, eldiven; yürüme döngüsü */
  var walker = D.createElement('div'); walker.className = 'kt-walker'; walker.setAttribute('aria-hidden', 'true');
  walker.innerHTML = '<svg viewBox="-80 -340 160 350"><ellipse cx="0" cy="2" rx="44" ry="8" fill="#0D1838" opacity=".14"/>' +
    '<g class="kt-w-body">' +
    /* arka kol ve bacak (koyu ton) */
    '<g class="kt-leg kt-leg-b"><rect x="-11" y="-134" width="22" height="126" rx="10" fill="#2A6F5F"/><path d="M-12 -12 h34 a8 8 0 0 1 0 12 h-34 z" fill="#E4EAF2"/></g>' +
    '<g class="kt-arm kt-arm-b"><rect x="-9" y="-232" width="18" height="96" rx="9" fill="#2F7E6D"/><circle cx="0" cy="-134" r="10" fill="#86B4E6"/></g>' +
    /* gövde: yandan önlük */
    '<path d="M-30 -236 C-32 -252 30 -252 30 -236 L32 -128 C32 -120 -34 -120 -34 -128 Z" fill="#3E8E7E"/><path d="M12 -246 L26 -226 L14 -222 Z" fill="#2C7A68"/><rect x="8" y="-206" width="18" height="12" rx="3" fill="#fff"/><text x="17" y="-197" text-anchor="middle" font-size="7" font-weight="800" fill="#2C7A68" font-family="sans-serif">AXM</text>' +
    '<rect x="-7" y="-262" width="16" height="18" fill="#E9B98F"/>' +
    /* baş: profil, bone, maske */
    '<g class="kt-head"><circle cx="4" cy="-292" r="32" fill="#E9B98F"/><ellipse cx="-12" cy="-290" rx="6" ry="9" fill="#DDA77C"/>' +
    '<path d="M-30 -298 C-32 -338 38 -340 38 -300 C24 -306 -6 -306 -30 -298 Z" fill="#3E8E7E"/><g fill="#fff" opacity=".55"><circle cx="-6" cy="-318" r="3"/><circle cx="12" cy="-326" r="3"/><circle cx="24" cy="-312" r="3"/></g>' +
    '<g class="kt-eye"><ellipse cx="20" cy="-296" rx="3.4" ry="4.4" fill="#0D1838"/></g><path d="M13 -306 q8 -4 14 0" stroke="#0D1838" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
    '<g class="kt-mask"><path d="M4 -284 C14 -288 30 -288 38 -282 C40 -272 36 -262 26 -260 C16 -258 6 -264 4 -272 Z" fill="#9FD8D0"/><path d="M8 -276 h28 M8 -270 h26" stroke="#7CC2B8" stroke-width="2"/><path d="M4 -280 L-12 -292" stroke="#7CC2B8" stroke-width="2"/></g></g>' +
    /* ön kol ve bacak */
    '<g class="kt-leg kt-leg-f"><rect x="-11" y="-134" width="22" height="126" rx="10" fill="#348572"/><path d="M-12 -12 h34 a8 8 0 0 1 0 12 h-34 z" fill="#fff"/></g>' +
    '<g class="kt-arm kt-arm-f"><rect x="-9" y="-232" width="18" height="96" rx="9" fill="#45998A" stroke="#2C7A68" stroke-width="2"/><circle cx="0" cy="-134" r="10" fill="#9CC3EE"/></g>' +
    '</g></svg>';
  stage.appendChild(walker);

  /* ---------------- scroll → kamera ---------------- */
  var cur = -1, lastY = W.scrollY, dir = 1, stopT = 0, raf = 0, s = 1, vw = 0, vh = 0;
  var REH = sts.map(function (st) { return st.getAttribute('data-reh') || ''; });
  var olcu = function () { vh = stage.clientHeight; vw = stage.clientWidth; s = vh / 600; stage.style.setProperty('--kt-s', s.toFixed(4)); [lFar, lMid, lNear].forEach(function (l) { var w = +l.getAttribute('viewBox').split(' ')[2]; l.style.width = (w * s) + 'px'; }); };
  var setStation = function (i) {
    if (i === cur) return; cur = i;
    sts.forEach(function (st, k) { st.classList.toggle('on', k === i); st.setAttribute('aria-hidden', String(k !== i)); });
    if (rail) Array.prototype.forEach.call(rail.querySelectorAll('li'), function (li, k) { li.classList.toggle('on', k === i); li.classList.toggle('done', k < i); });
    sec.style.setProperty('--kt-c', renk[i]);
    sec.classList.toggle('kt-final', i === n - 1);
    if (W.acadiaRehber && W.acadiaRehber.at === 'medlab' && REH[i]) W.acadiaRehber.say(REH[i], i === n - 1 ? 'kutlama' : 'mutlu', i === n - 1 ? 'zipla' : 'isaret');
  };
  var ciz = function () {
    raf = 0;
    var r = track.getBoundingClientRect(), len = Math.max(1, track.offsetHeight - vh);
    var p = Math.min(1, Math.max(0, -r.top / len)), f = p * (n - 1);
    var tx = vw * 0.6 - (X0 + f * SP) * s;
    lMid.style.transform = 'translate3d(' + tx.toFixed(1) + 'px,0,0)';
    lFar.style.transform = 'translate3d(' + (tx * 0.45).toFixed(1) + 'px,0,0)';
    lNear.style.transform = 'translate3d(' + (tx * 1.3).toFixed(1) + 'px,0,0)';
    var near = Math.abs(f - Math.round(f));
    walker.style.setProperty('--kt-wx', (near < 0.18 ? 0.42 : 0.34));   /* durakta binaya biraz yaklaş */
    setStation(Math.round(f));
  };
  var onScroll = function () {
    var y = W.scrollY; if (y !== lastY) { var d = y > lastY ? 1 : -1; if (d !== dir) { dir = d; walker.classList.toggle('kt-back', dir < 0); } }
    lastY = y;
    walker.classList.add('kt-walk'); clearTimeout(stopT); stopT = setTimeout(function () { walker.classList.remove('kt-walk'); }, 180);
    if (!raf) raf = requestAnimationFrame(ciz);
  };
  olcu(); ciz();
  W.addEventListener('scroll', onScroll, { passive: true });
  W.addEventListener('resize', function () { olcu(); ciz(); });

  /* rehber bu bölüme gelince o anki durağı anlatsın */
  if (W.IntersectionObserver) new IntersectionObserver(function (es) {
    if (es[0].isIntersecting && cur > -1 && W.acadiaRehber) { var k = cur; cur = -1; setStation(k); }
    D.body.classList.toggle('kt-in', es[0].isIntersecting);
  }, { threshold: 0.35 }).observe(stage);
})();
