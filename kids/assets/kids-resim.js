/* ==========================================================================
   ACADEX KIDS · tema çizimleri (kids/assets/kids-resim.js), 12.11.2026
   On temanın (Animals … Feelings) her kelimesinin çizimi, oyun sahneleri ve
   tema rozetleri. Çizim dili kids-ciz.js ile aynı: lacivert kontur (3), düz renk,
   100x100 düzlem. Aile, duygu ve vücut çizimleri tek bir parametreli yüz/insan
   çiziminden çıkar; tutarlı ve küçük kalır. KIDS_CIZ.simge() ve ada() bilmediği
   bir adı buradan ister, bu yüzden çıkartmalar ve ada simgeleri de buradan gelir.
   W.KIDS_RESIM
   ========================================================================== */
(function (W) {
  'use strict';
  var C = W.KIDS_CIZ, M = '#23304D', S = 'stroke="' + M + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
  var TEN = '#FFD9C2';
  function p(d, f) { return '<path d="' + d + '" fill="' + (f || 'none') + '" ' + S + '/>'; }
  function c(x, y, r, f) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + (f || 'none') + '" ' + S + '/>'; }
  function e(x, y, rx, ry, f) { return '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + ry + '" fill="' + (f || 'none') + '" ' + S + '/>'; }
  function r(x, y, w, h, k, f) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + k + '" fill="' + (f || 'none') + '" ' + S + '/>'; }
  function n(x, y, k, f) { return '<circle cx="' + x + '" cy="' + y + '" r="' + k + '" fill="' + (f || M) + '"/>'; }
  function iz(d, renk, w) { return '<path d="' + d + '" fill="none" stroke="' + renk + '" stroke-width="' + (w || 4) + '" stroke-linecap="round" stroke-linejoin="round"/>'; }
  /* kalın çizgi: önce kontur, sonra renk (kol, bacak, rüzgâr, sis) */
  function kalin(d, renk, w) { return iz(d, M, w + 6) + iz(d, renk, w); }
  function g(t, ic) { return '<g transform="' + t + '">' + ic + '</g>'; }
  function yazi(x, y, t, boy, renk) { return '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-family="\'Baloo 2\',Nunito,sans-serif" font-weight="800" font-size="' + boy + '" fill="' + (renk || '#fff') + '" stroke="' + M + '" stroke-width="1.6" paint-order="stroke">' + t + '</text>'; }
  function parlak(d) { return iz(d, '#fff', 5) .replace('stroke-width="5"', 'stroke-width="5" opacity=".6"'); }
  function yildizYol(cx, cy, R, k, uc) {
    var q = []; for (var i = 0; i < uc * 2; i++) { var a = -Math.PI / 2 + i * Math.PI / uc, u = i % 2 ? k : R; q.push((cx + u * Math.cos(a)).toFixed(1) + ',' + (cy + u * Math.sin(a)).toFixed(1)); }
    return '<polygon points="' + q.join(' ') + '"';
  }
  function yildiz(cx, cy, R, renk) { return yildizYol(cx, cy, R, R * 0.48, 5) + ' fill="' + renk + '" ' + S + '/>'; }
  /* kids-ciz'in tam svg'sinden iç çizimi al (avatar, simge yeniden kullanılır) */
  function icAl(s) { return String(s).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''); }
  function hazir(ad) { return icAl(C.simge(ad)); }

  /* ---------- hava parçaları ---------- */
  function gunes(x, y, k) {
    var isin = ''; for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, x1 = x + (k + 5) * Math.cos(a), y1 = y + (k + 5) * Math.sin(a), x2 = x + (k + 13) * Math.cos(a), y2 = y + (k + 13) * Math.sin(a); isin += 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' L' + x2.toFixed(1) + ' ' + y2.toFixed(1) + ' '; }
    return '<path d="' + isin + '" ' + S + ' stroke-width="4"/>' + c(x, y, k, '#FFD23F') + '<path d="M' + (x - k * 0.5) + ' ' + (y - k * 0.2) + ' q' + (k * 0.2) + ' ' + (-k * 0.5) + ' ' + (k * 0.6) + ' ' + (-k * 0.5) + '" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>';
  }
  var BULUT = 'M14 40 q-14 0 -14 -12 q0 -12 14 -12 q2 -16 20 -16 q14 0 20 12 q4 -4 12 -2 q12 2 12 16 q10 2 10 10 q0 8 -10 8 z';
  function bulut(x, y, s, f) { return g('translate(' + x + ' ' + y + ') scale(' + s + ')', '<path d="' + BULUT + '" fill="' + (f || '#fff') + '" stroke="' + M + '" stroke-width="' + (3 / s).toFixed(2) + '" stroke-linejoin="round"/>'); }
  function damla(x, y, f) { return p('M' + x + ' ' + y + ' q-5 8 -5 11 q0 5 5 5 q5 0 5 -5 q0 -3 -5 -11 z', f || '#4AA8FF'); }
  function kar(x, y, k) { return iz('M' + x + ' ' + (y - k) + ' V' + (y + k) + ' M' + (x - k * 0.87) + ' ' + (y - k / 2) + ' L' + (x + k * 0.87) + ' ' + (y + k / 2) + ' M' + (x - k * 0.87) + ' ' + (y + k / 2) + ' L' + (x + k * 0.87) + ' ' + (y - k / 2), M, 3); }
  function termometre(renk, dolu) { return r(64, 12, 16, 60, 8, '#fff') + '<rect x="69" y="' + (66 - dolu) + '" width="6" height="' + (dolu + 6) + '" rx="3" fill="' + renk + '"/>' + c(72, 76, 12, renk) + iz('M82 24 h5 M82 36 h5 M82 48 h5', M, 2.4); }

  /* ---------- insan (aile) ---------- */
  function kisi(o) {
    var sac = o.sac || '#8F5A3A', h = '', on = '';
    if (o.stil === 'uzun') h += p('M28 48 q-4 -32 22 -32 q26 0 22 32 v26 h-10 v-22 h-24 v22 h-10 z', sac);
    if (o.stil === 'kuyruk') h += c(25, 40, 9, sac) + c(75, 40, 9, sac);
    if (o.stil === 'topuz') h += c(50, 17, 9, sac);
    if (o.stil === 'kivircik') h += c(32, 34, 9, sac) + c(40, 26, 9, sac) + c(50, 23, 9, sac) + c(60, 26, 9, sac) + c(68, 34, 9, sac) + c(29, 46, 7, sac) + c(71, 46, 7, sac);
    h += p('M20 98 q0 -28 30 -28 q30 0 30 28 z', o.ust || '#4AA8FF') + p('M42 70 q8 8 16 0', TEN);
    h += c(50, 46, 21, TEN) + c(29, 48, 5, TEN) + c(71, 48, 5, TEN);
    if (o.stil === 'uzun' || o.stil === 'kuyruk' || o.stil === 'topuz' || o.stil === 'kisa') on = p('M29 42 q0 -22 21 -22 q21 0 21 22 q-6 -10 -14 -10 q-8 6 -22 2 q-6 2 -6 8 z', sac);
    if (o.stil === 'diken') on = p('M29 40 l2 -14 l7 7 l4 -14 l7 9 l4 -12 l5 12 l6 -8 l2 12 l4 8 q-20 -8 -41 0 z', sac);
    if (o.stil === 'kel') on = iz('M30 46 q-2 -8 3 -13 M70 46 q2 -8 -3 -13', sac, 6);
    if (o.stil === 'bebek') on = iz('M48 26 q2 -8 8 -4 q2 5 -4 6', M, 3);
    h += on;
    if (o.sakal) h += p('M30 48 q2 24 20 24 q18 0 20 -24 q-6 10 -20 10 q-14 0 -20 -10 z', sac);
    h += n(43, 46, 2.8) + n(57, 46, 2.8) + '<circle cx="38" cy="54" r="3.4" fill="#FF9EB5" opacity=".7"/><circle cx="62" cy="54" r="3.4" fill="#FF9EB5" opacity=".7"/>';
    h += o.biyik ? p('M41 55 q9 -6 18 0 q-9 3 -18 0 z', sac) : iz('M44 55 q6 5 12 0', M, 3);
    if (o.gozluk) h += c(43, 46, 6.5) + c(57, 46, 6.5) + iz('M49.5 46 h1', M, 3);
    if (o.toka) h += c(66, 28, 4.5, o.toka);
    return o.olcek ? g('translate(' + (50 - 50 * o.olcek) + ' ' + (100 - 100 * o.olcek) + ') scale(' + o.olcek + ')', h) : h;
  }
  var AILE = {
    mum: { stil: 'uzun', sac: '#8F5A3A', ust: '#FF6FA5', toka: '#FFD23F' },
    dad: { stil: 'kisa', sac: '#3B2A22', ust: '#4AA8FF', sakal: 1 },
    baby: { stil: 'bebek', ust: '#FFD84D', olcek: 0.78 },
    sister: { stil: 'kuyruk', sac: '#C9773A', ust: '#8E7CF0', olcek: 0.88 },
    brother: { stil: 'diken', sac: '#3B2A22', ust: '#4CC38A', olcek: 0.88 },
    grandma: { stil: 'topuz', sac: '#C7CCD6', ust: '#C9A7E8', gozluk: 1 },
    grandpa: { stil: 'kel', sac: '#C7CCD6', ust: '#C98A4B', gozluk: 1, biyik: 1 },
    aunt: { stil: 'kivircik', sac: '#E26A3D', ust: '#FF9F45' },
    uncle: { stil: 'kisa', sac: '#C9773A', ust: '#2EB5A8', biyik: 1 }
  };

  /* ---------- duygu yüzleri ---------- */
  function yuz(d) {
    var ten = { angry: '#FF9E7A', scared: '#E6EEFF', tired: '#FFE6A6', sick: '#CDEFC4', worried: '#FFE6A6' }[d] || '#FFD84D', h = c(50, 52, 40, ten), goz = '', agiz = '', ek = '';
    var nokGoz = n(36, 46, 4.6) + n(64, 46, 4.6) + n(37.4, 44.6, 1.5, '#fff') + n(65.4, 44.6, 1.5, '#fff');
    if (d === 'happy') { goz = iz('M29 46 q7 -8 14 0 M57 46 q7 -8 14 0', M, 3.4); agiz = p('M30 58 q20 26 40 0 z', '#E5484D'); }
    if (d === 'sad') { goz = nokGoz + iz('M28 36 l12 -4 M72 36 l-12 -4', M, 3); agiz = iz('M36 72 q14 -12 28 0', M, 3.4); ek = damla(30, 54); }
    if (d === 'angry') { goz = nokGoz + iz('M26 32 l16 8 M74 32 l-16 8', M, 3.6); agiz = iz('M36 70 q14 -8 28 0', M, 3.6); }
    if (d === 'scared') { goz = c(36, 46, 8, '#fff') + c(64, 46, 8, '#fff') + n(36, 47, 3) + n(64, 47, 3) + iz('M28 32 q8 -6 16 -2 M56 30 q8 -4 16 2', M, 3); agiz = iz('M34 70 q4 -6 8 0 q4 6 8 0 q4 -6 8 0 q4 6 8 0', M, 3); ek = damla(78, 24, '#BDE8F2'); }
    if (d === 'surprised') { goz = c(36, 44, 7, '#fff') + c(64, 44, 7, '#fff') + n(36, 44, 3.4) + n(64, 44, 3.4) + iz('M28 30 q8 -8 16 0 M56 30 q8 -8 16 0', M, 3); agiz = e(50, 68, 7, 9, '#7A2F3A'); }
    if (d === 'tired') { goz = iz('M29 48 h14 M57 48 h14', M, 3.4) + iz('M29 44 q7 4 14 0 M57 44 q7 4 14 0', M, 2.4); agiz = e(50, 68, 5, 4, '#7A2F3A'); ek = yazi(82, 22, 'z', 18, '#8E7CF0') + yazi(90, 10, 'z', 12, '#8E7CF0'); }
    if (d === 'hungry') { goz = n(36, 42, 4.4) + n(64, 42, 4.4) + n(37, 40.6, 1.4, '#fff') + n(65, 40.6, 1.4, '#fff'); agiz = p('M34 60 q16 18 32 0 z', '#7A2F3A') + p('M54 64 q8 12 14 2 q-4 -6 -14 -2 z', '#FF7A8A'); }
    if (d === 'excited') { goz = yildiz(36, 45, 9, '#FF8A3D') + yildiz(64, 45, 9, '#FF8A3D'); agiz = p('M28 58 q22 30 44 0 z', '#E5484D') + '<path d="M40 70 q10 6 20 0" fill="#FF9EB5"/>'; }
    if (d === 'shy') { goz = iz('M30 48 q6 4 12 0 M58 48 q6 4 12 0', M, 3.2); agiz = iz('M45 64 q5 4 10 0', M, 3); ek = '<ellipse cx="30" cy="58" rx="8" ry="5" fill="#FF6FA5" opacity=".75"/><ellipse cx="70" cy="58" rx="8" ry="5" fill="#FF6FA5" opacity=".75"/>' + iz('M24 58 l4 -3 M30 58 l4 -3 M66 58 l4 -3 M72 58 l4 -3', '#fff', 2); }
    if (d === 'proud') { goz = iz('M29 44 q7 -6 14 0 M57 44 q7 -6 14 0', M, 3.2); agiz = iz('M36 62 q14 12 28 0', M, 3.4); ek = yildiz(80, 18, 10, '#FFD23F') + iz('M30 30 l12 2 M70 30 l-12 2', M, 3); }
    if (d === 'worried') { goz = nokGoz + iz('M28 34 l12 4 M72 34 l-12 4', M, 3); agiz = iz('M38 70 q6 -4 12 0 q6 4 12 0', M, 3); ek = damla(80, 30, '#BDE8F2'); }
    if (d === 'silly') { goz = c(36, 46, 7, '#fff') + n(38, 48, 3) + iz('M57 46 q7 -6 14 0', M, 3.4); agiz = p('M32 60 q18 18 36 0 z', '#7A2F3A') + p('M44 66 q6 14 12 0 z', '#FF7A8A'); }
    if (d === 'brave') { goz = nokGoz + iz('M27 36 l14 2 M73 36 l-14 2', M, 3.6); agiz = p('M34 62 q16 12 32 0 z', '#fff'); ek = p('M10 74 l10 -10 l10 10 l-10 18 z', '#E5484D'); }
    if (d === 'loved') { goz = p('M29 42 q3 -5 7 -1 q4 -4 7 1 q-1 6 -7 10 q-6 -4 -7 -10 z', '#E5484D') + p('M57 42 q3 -5 7 -1 q4 -4 7 1 q-1 6 -7 10 q-6 -4 -7 -10 z', '#E5484D'); agiz = p('M34 60 q16 16 32 0 z', '#E5484D'); }
    if (d === 'sleepy') { goz = iz('M29 48 q7 4 14 0 M57 48 q7 4 14 0', M, 3.2); agiz = e(50, 68, 6, 7, '#7A2F3A'); ek = yazi(84, 24, 'Z', 16, '#4AA8FF'); }
    if (d === 'calm') { goz = iz('M29 46 q7 5 14 0 M57 46 q7 5 14 0', M, 3); agiz = iz('M40 64 q10 7 20 0', M, 3); ek = p('M80 70 q8 -10 14 -2 q-6 10 -14 2 z', '#4CC38A'); }
    if (d === 'nervous') { goz = c(36, 46, 6, '#fff') + c(64, 46, 6, '#fff') + n(38, 46, 2.4) + n(66, 46, 2.4); agiz = p('M36 64 h28 v6 h-28 z', '#fff') + iz('M43 64 v6 M50 64 v6 M57 64 v6', M, 2); ek = damla(24, 30, '#BDE8F2'); }
    if (d === 'sick') { goz = iz('M30 44 l10 6 M30 50 l10 -6 M58 44 l10 6 M58 50 l10 -6', M, 2.6); agiz = iz('M38 70 q12 -6 24 0', M, 3.2); ek = r(68, 60, 8, 22, 4, '#fff') + '<rect x="70" y="72" width="4" height="9" fill="#E5484D"/>'; }
    if (d === 'thirsty') { goz = nokGoz; agiz = p('M40 64 q10 -6 20 0 q-10 10 -20 0 z', '#7A2F3A'); ek = damla(82, 16, '#4AA8FF') + damla(90, 34, '#4AA8FF'); }
    if (d === 'bored') { goz = iz('M28 44 h16 M56 44 h16', M, 3) + n(36, 48, 3.6) + n(64, 48, 3.6); agiz = iz('M38 68 h22', M, 3.4); ek = iz('M18 20 q-4 -4 0 -8', '#9AA7BD', 3); }
    return h + goz + agiz + ek;
  }

  /* ---------- vücut (yakın çizim) ---------- */
  var VUCUT = {
    head: c(50, 52, 32, TEN) + c(18, 54, 6, TEN) + c(82, 54, 6, TEN) + p('M20 46 q0 -30 30 -30 q30 0 30 30 q-10 -14 -22 -12 q-12 8 -38 12 z', '#8F5A3A') + n(40, 54, 3.4) + n(60, 54, 3.4) + iz('M42 66 q8 7 16 0', M, 3) + '<circle cx="33" cy="62" r="4" fill="#FF9EB5" opacity=".7"/><circle cx="67" cy="62" r="4" fill="#FF9EB5" opacity=".7"/>',
    hair: p('M14 74 q-6 -60 36 -60 q42 0 36 60 q-6 -24 -16 -28 q-6 8 -20 4 q-14 -4 -20 -2 q-12 6 -16 26 z', '#8F5A3A') + iz('M38 22 q-6 10 -6 20 M52 18 q2 12 -2 22 M64 22 q6 10 4 20', '#B9784C', 3),
    eyes: e(28, 50, 18, 13, '#fff') + c(28, 50, 8, '#4AA8FF') + n(28, 50, 3.6) + n(30, 47, 1.6, '#fff') + e(72, 50, 18, 13, '#fff') + c(72, 50, 8, '#4AA8FF') + n(72, 50, 3.6) + n(74, 47, 1.6, '#fff') + iz('M12 36 l4 4 M22 30 l2 5 M88 36 l-4 4 M78 30 l-2 5', M, 3),
    ears: p('M42 12 q34 -4 34 34 q0 22 -16 30 q-6 4 -6 12 q0 12 -14 12 q-14 0 -14 -16', TEN) + iz('M48 30 q14 -2 14 16 q0 10 -8 14', M, 3),
    nose: p('M54 14 q-2 30 -20 46 q-8 10 6 14 q14 4 28 -2 q8 -6 0 -14', '#FFC2A1') + n(42, 66, 3) + n(58, 66, 3),
    mouth: p('M12 50 q18 -18 38 -8 q20 -10 38 8 q-14 30 -38 30 q-24 0 -38 -30 z', '#FF6F7D') + p('M18 51 q32 12 64 0 q-4 8 -32 8 q-28 0 -32 -8 z', '#fff') + parlak('M30 46 q6 -4 12 -2'),
    hands: r(30, 14, 9, 44, 4.5, TEN) + r(41, 8, 9, 46, 4.5, TEN) + r(52, 10, 9, 44, 4.5, TEN) + r(63, 18, 8, 38, 4, TEN) + p('M32 64 q-20 -4 -22 -20 q2 -8 10 -4 q4 10 14 12', TEN) + r(30, 42, 41, 44, 16, TEN) + iz('M40 72 q10 6 20 0', '#F2B39A', 3),
    feet: p('M14 24 h26 v32 q26 0 38 12 q10 10 -2 16 h-62 z', TEN) + c(76, 72, 4.4, TEN) + c(66, 66, 4.4, TEN) + c(57, 62, 4, TEN) + iz('M24 84 h40', '#F2B39A', 3),
    arms: kalin('M14 88 Q30 60 52 54 Q70 48 74 26', TEN, 14) + '<path d="M8 96 l14 -22 l12 8 l-10 18 z" fill="#4CC38A" ' + S + '/>' + c(76, 20, 10, TEN) + iz('M48 40 q10 -10 16 0', '#F2B39A', 3),
    legs: r(26, 6, 48, 24, 6, '#4AA8FF') + kalin('M38 28 V80', TEN, 14) + kalin('M62 28 V80', TEN, 14) + e(32, 88, 13, 7, '#E5484D') + e(68, 88, 13, 7, '#E5484D')
  };

  /* ---------- kelime çizimleri ---------- */
  var R = {
    /* animals */
    cat: function () { return icAl(C.avatar('kedi')); }, dog: function () { return icAl(C.avatar('kopek')); }, rabbit: function () { return icAl(C.avatar('tavsan')); },
    frog: function () { return icAl(C.avatar('kurbaga')); }, chick: function () { return icAl(C.avatar('civciv')); }, bear: function () { return icAl(C.avatar('ayi')); },
    fish: function () { return hazir('balik'); }, bird: function () { return hazir('kus'); },
    cow: function () {
      return p('M32 30 q-10 -14 -4 -22 q4 8 12 12 z', '#FFF3DD') + p('M68 30 q10 -14 4 -22 q-4 8 -12 12 z', '#FFF3DD') + p('M28 40 q-18 -8 -24 4 q10 10 24 2 z', '#fff') + p('M72 40 q18 -8 24 4 q-10 10 -24 2 z', '#fff') +
        e(50, 50, 26, 28, '#fff') + p('M58 24 q14 2 16 18 q-10 4 -16 -4 q-4 -6 0 -14 z', M) + p('M30 36 q6 -6 10 2 q-2 8 -10 4 z', M) + e(50, 70, 22, 15, '#FFB8C8') + n(42, 70, 3.2) + n(58, 70, 3.2) + n(40, 48, 4.4) + n(60, 48, 4.4) + n(41.4, 46.4, 1.5, '#fff') + n(61.4, 46.4, 1.5, '#fff');
    },
    lion: function () {
      return yildizYol(50, 52, 46, 36, 12) + ' fill="#C9773A" ' + S + '/>' + c(31, 30, 8, '#FFC94D') + c(69, 30, 8, '#FFC94D') + c(50, 54, 28, '#FFC94D') + e(50, 64, 12, 9, '#FFE6A6') +
        n(40, 50, 4.2) + n(60, 50, 4.2) + n(41.4, 48.4, 1.4, '#fff') + n(61.4, 48.4, 1.4, '#fff') + p('M45 59 h10 l-5 6 z', M) + iz('M50 65 q-5 6 -10 2 M50 65 q5 6 10 2', M, 2.6);
    },
    /* family */
    family: function () { return g('translate(-16 6) scale(.7)', kisi(AILE.dad)) + g('translate(46 6) scale(.7)', kisi(AILE.mum)) + g('translate(19 30) scale(.62)', kisi({ stil: 'bebek', ust: '#FFD84D' })); },
    /* food */
    apple: function () { return hazir('elma'); }, strawberry: function () { return hazir('cilek'); },
    banana: function () { return p('M24 22 q-6 44 30 58 q24 8 38 -8 q-26 6 -44 -12 q-14 -14 -16 -38 z', '#FFD84D') + p('M24 22 l-2 -10 l7 -1 l1 9 z', '#8F5A3A') + iz('M30 38 q4 22 22 32', '#F2B92A', 3) + p('M92 72 l3 3', M); },
    bread: function () { return p('M12 50 q0 -26 38 -26 q38 0 38 26 q0 8 -8 8 v26 h-60 v-26 q-8 0 -8 -8 z', '#D9934A') + p('M22 50 q0 -16 28 -16 q28 0 28 16 q0 4 -6 4 v24 h-44 v-24 q-6 0 -6 -4 z', '#FFE6B8') + n(40, 60, 1.6, '#D9B37A') + n(56, 66, 1.6, '#D9B37A') + n(48, 50, 1.6, '#D9B37A'); },
    milk: function () { return p('M30 30 l10 -16 h20 l10 16 v58 h-40 z', '#fff') + p('M40 14 l-10 16 h40 l-10 -16', '#E3F1FF') + r(30, 48, 40, 24, 0, '#4AA8FF') + yazi(50, 66, 'MILK', 12) + r(44, 6, 12, 8, 2, '#4AA8FF'); },
    egg: function () { return p('M18 54 q-6 -26 20 -30 q14 -14 32 -2 q24 4 16 30 q4 22 -24 24 q-14 8 -28 0 q-20 -4 -16 -22 z', '#fff') + c(48, 52, 14, '#FFC93D') + parlak('M42 46 q3 -4 8 -4'); },
    cheese: function () { return p('M10 50 L66 22 L90 44 V76 H10 Z', '#FFD84D') + iz('M10 50 H90', M, 3) + '<circle cx="28" cy="62" r="5" fill="#F2B92A"/><circle cx="54" cy="66" r="7" fill="#F2B92A"/><circle cx="76" cy="58" r="4" fill="#F2B92A"/><circle cx="58" cy="38" r="4" fill="#F2B92A"/>'; },
    cake: function () { return iz('M8 88 h84', M, 3) + r(18, 50, 64, 36, 6, '#FFB3CF') + p('M18 60 q8 9 16 0 q8 9 16 0 q8 9 16 0 q8 9 16 0 V56 q0 -6 -6 -6 H24 q-6 0 -6 6 z', '#fff') + r(46, 26, 8, 24, 2, '#4AA8FF') + p('M50 10 q7 8 0 14 q-7 -6 0 -14 z', '#FFB020') + c(30, 72, 3.4, '#E5484D') + c(50, 74, 3.4, '#E5484D') + c(70, 72, 3.4, '#E5484D'); },
    carrot: function () { return p('M50 34 q-14 -10 -12 -26 q10 6 12 22 z', '#4CC38A') + p('M50 34 q14 -10 12 -26 q-10 6 -12 22 z', '#4CC38A') + p('M34 36 Q50 28 66 36 L53 92 Q50 97 47 92 Z', '#FF8A3D') + iz('M42 50 h7 M53 62 h7 M45 74 h6', M, 2.6); },
    juice: function () { return iz('M58 36 l10 -28 h10', '#E5484D', 5) + p('M26 22 h48 l-6 68 h-36 z', '#E8F6FF') + p('M29 38 h42 l-4.6 49 h-32.8 z', '#FF9F1C') + c(28, 24, 10, '#FFB347') + iz('M28 16 v16 M20 24 h16', '#FFE0A8', 2.4) + parlak('M36 46 v28'); },
    /* toys */
    ball: function () { return hazir('top'); }, car: function () { return hazir('araba'); },
    teddy: function () { return c(28, 22, 10, '#C98A4B') + c(72, 22, 10, '#C98A4B') + c(28, 22, 4.6, '#F3D9B5') + c(72, 22, 4.6, '#F3D9B5') + c(24, 68, 9, '#C98A4B') + c(76, 68, 9, '#C98A4B') + e(50, 74, 24, 21, '#C98A4B') + e(50, 77, 13, 12, '#F3D9B5') + c(50, 36, 22, '#C98A4B') + e(50, 43, 9, 7, '#F3D9B5') + n(50, 40, 3.2) + n(41, 31, 3) + n(59, 31, 3) + p('M50 57 l-11 -6 v12 z M50 57 l11 -6 v12 z', '#E5484D'); },
    doll: function () { return p('M27 46 q-2 -36 23 -36 q25 0 23 36 v22 h-9 v-16 h-28 v16 h-9 z', '#8F5A3A') + iz('M34 64 l-10 14 M66 64 l10 14', TEN, 6) + iz('M42 90 v6 M58 90 v6', M, 4) + p('M36 56 h28 l14 36 h-56 z', '#FF6FA5') + c(50, 36, 17, TEN) + p('M33 32 q4 -16 17 -16 q13 0 17 16 q-10 -8 -17 -4 q-7 -4 -17 4 z', '#8F5A3A') + n(44, 37, 2.8) + n(56, 37, 2.8) + iz('M45 44 q5 4 10 0', M, 2.6) + c(50, 70, 3, '#fff') + c(42, 80, 3, '#fff') + c(58, 80, 3, '#fff'); },
    kite: function () { return iz('M50 72 q-10 8 0 14 q10 6 0 12', M, 2.6) + p('M44 82 l12 -4 v8 z', '#E5484D') + p('M50 8 L78 40 L50 72 L22 40 Z', '#4AA8FF') + p('M50 8 L78 40 H50 Z', '#FFD23F') + p('M22 40 L50 72 V40 Z', '#FFD23F') + iz('M50 8 V72 M22 40 H78', M, 3); },
    blocks: function () { return r(12, 54, 34, 34, 4, '#E5484D') + yazi(29, 79, 'A', 22) + r(54, 54, 34, 34, 4, '#4AA8FF') + yazi(71, 79, 'B', 22) + r(33, 18, 34, 34, 4, '#FFD23F') + yazi(50, 43, 'C', 22); },
    train: function () { return c(23, 16, 6, '#fff') + c(31, 8, 4, '#fff') + r(18, 26, 10, 18, 2, M) + r(10, 42, 52, 32, 4, '#E5484D') + r(40, 22, 26, 52, 4, '#4AA8FF') + r(46, 30, 14, 12, 2, '#fff') + iz('M66 64 h6', M, 3) + r(72, 46, 22, 28, 4, '#4CC38A') + c(24, 80, 9, '#FFD23F') + c(52, 80, 9, '#FFD23F') + c(83, 80, 7, '#FFD23F') + n(24, 80, 2.6) + n(52, 80, 2.6) + n(83, 80, 2.2); },
    robot: function () { return iz('M50 16 v-6', M, 3) + c(50, 8, 4.4, '#E5484D') + r(30, 14, 40, 30, 8, '#B9C7FF') + c(41, 29, 5.4, '#fff') + c(59, 29, 5.4, '#fff') + n(41, 29, 2.4) + n(59, 29, 2.4) + r(42, 37, 16, 4, 2, M) + iz('M28 58 h-12 v14 M72 58 h12 v14', M, 4) + r(26, 48, 48, 36, 8, '#8E7CF0') + c(50, 62, 6, '#FFD23F') + iz('M38 76 h24', '#fff', 3) + r(34, 84, 10, 10, 2, '#B9C7FF') + r(56, 84, 10, 10, 2, '#B9C7FF'); },
    drum: function () { return p('M16 36 v34 q34 20 68 0 v-34', '#E5484D') + iz('M16 44 L30 68 L44 46 L58 70 L72 46 L84 64', '#fff', 3) + e(50, 36, 34, 11, '#FFF3DD') + iz('M62 10 l-14 22 M86 16 l-26 18', M, 3.4) + c(62, 9, 4.4, '#FFD23F') + c(87, 15, 4.4, '#FFD23F'); },
    balloon: function () { return iz('M50 86 q-6 6 2 12', M, 2.6) + p('M50 8 c22 0 32 16 32 36 c0 20 -16 36 -32 36 c-16 0 -32 -16 -32 -36 c0 -20 10 -36 32 -36 z', '#2EB5A8') + p('M45 80 h10 l3 7 h-16 z', '#2EB5A8') + parlak('M32 34 q4 -14 16 -18'); },
    /* clothes */
    hat: function () { return e(50, 66, 42, 11, '#FFD23F') + p('M28 64 q0 -34 22 -34 q22 0 22 34 z', '#FFD23F') + p('M29 54 q21 6 42 0 v9 q-21 6 -42 0 z', '#E5484D') + parlak('M36 46 q2 -8 8 -10'); },
    tshirt: function () { return p('M34 16 L18 24 L6 42 L20 52 L28 44 V88 H72 V44 L80 52 L94 42 L82 24 L66 16 Q50 30 34 16 Z', '#4CC38A') + yildiz(50, 58, 10, '#FFD23F'); },
    dress: function () { return iz('M40 14 v8 M60 14 v8', M, 3) + p('M38 20 h24 l-2 16 l24 52 h-68 l24 -52 z', '#FF6FA5') + p('M40 36 h20', M) + '<circle cx="40" cy="58" r="3" fill="#fff"/><circle cx="60" cy="62" r="3" fill="#fff"/><circle cx="48" cy="74" r="3" fill="#fff"/><circle cx="68" cy="80" r="3" fill="#fff"/><circle cx="30" cy="80" r="3" fill="#fff"/>'; },
    shoes: function () { var t = p('M8 72 v-18 q0 -6 6 -6 h12 q4 10 14 10 h10 q10 0 10 10 v4 z', '#4AA8FF') + r(6, 72, 56, 7, 3, '#fff') + iz('M22 54 l6 4 M28 50 l6 4', '#fff', 2.4); return g('translate(32 -22)', t) + t; },
    socks: function () { var t = p('M26 12 h18 v40 l14 14 q6 8 -2 14 q-8 6 -16 -2 l-14 -16 z', '#E5484D') + iz('M27 22 h16 M27 32 h16', '#fff', 3); return g('translate(30 6)', t.replace(/#E5484D/g, '#FFD23F')) + t; },
    coat: function () { return p('M36 14 L20 22 L12 82 H30 V88 H70 V82 H88 L80 22 L64 14 L50 30 Z', '#C98A4B') + iz('M50 30 V88', M, 3) + p('M36 14 L44 34 L50 30 L56 34 L64 14', '#F3D9B5') + n(56, 46, 2.6) + n(56, 60, 2.6) + n(56, 74, 2.6) + r(26, 60, 14, 12, 3, '#B07A40') + r(62, 60, 14, 12, 3, '#B07A40'); },
    scarf: function () { return p('M58 42 l8 44 h14 l-6 -46 z', '#FF5A6E') + iz('M66 86 v6 M72 86 v6 M78 86 v6', M, 3) + p('M18 28 q32 18 64 0 v16 q-32 18 -64 0 z', '#FF5A6E') + iz('M62 58 h13 M64 72 h13', '#fff', 3.4) + iz('M30 40 q20 8 40 0', '#fff', 3); },
    gloves: function () { var t = p('M30 88 V48 q0 -24 18 -24 q18 0 18 20 v10 l8 -6 q8 -4 10 4 q2 6 -6 12 l-12 12 V88 Z', '#8E7CF0') + r(28, 78, 40, 12, 4, '#fff'); return g('translate(-14 4) scale(.86)', t) + g('translate(30 4) scale(.86)', t.replace('#8E7CF0', '#B9A8FF')); },
    trousers: function () { return p('M28 10 H72 L82 90 H58 L50 40 L42 90 H18 Z', '#2E7DD8') + iz('M28 20 H72', M, 3) + iz('M50 20 V40', M, 3) + iz('M34 26 q6 6 12 0', '#9CC8FF', 2.4); },
    boots: function () { var t = p('M26 12 h24 v48 l18 8 q8 4 8 12 v8 h-50 z', '#FFC93D') + r(24, 10, 28, 10, 3, '#FFC93D') + iz('M26 86 h50', M, 6); return g('translate(18 4) scale(.82)', t.replace(/#FFC93D/g, '#FFB020')) + g('translate(-4 4) scale(.82)', t); },
    /* home */
    bed: function () { return r(8, 28, 14, 58, 4, '#C98A4B') + r(20, 54, 72, 18, 4, '#fff') + p('M42 52 h46 q4 0 4 4 v16 h-50 z', '#4AA8FF') + r(24, 42, 22, 13, 6, '#FFE2BF') + r(20, 70, 72, 9, 2, '#C98A4B') + iz('M88 79 v10 M24 79 v10', M, 4); },
    chair: function () { return r(28, 8, 44, 44, 6, '#E8A85A') + iz('M40 16 v30 M50 16 v30 M60 16 v30', '#C98A4B', 3) + r(22, 50, 56, 11, 3, '#C98A4B') + r(27, 61, 7, 30, 2, '#B07A40') + r(66, 61, 7, 30, 2, '#B07A40'); },
    table: function () { return r(12, 46, 10, 44, 2, '#B07A40') + r(78, 46, 10, 44, 2, '#B07A40') + r(6, 36, 88, 12, 4, '#C98A4B') + p('M40 20 h14 v12 q0 4 -4 4 h-6 q-4 0 -4 -4 z', '#fff') + iz('M54 24 q6 0 6 5 q0 5 -6 5', M, 2.6) + c(70, 28, 7, '#E5484D'); },
    sofa: function () { return r(16, 26, 68, 32, 10, '#E5484D') + r(20, 54, 60, 22, 4, '#FF7A80') + iz('M50 56 v20', M, 3) + r(6, 44, 18, 38, 8, '#E5484D') + r(76, 44, 18, 38, 8, '#E5484D') + iz('M14 82 v8 M86 82 v8', M, 4) + r(28, 36, 14, 14, 4, '#FFD23F'); },
    lamp: function () { return iz('M14 56 l-6 4 M86 56 l6 4 M24 66 l-4 6 M76 66 l4 6', '#FFB020', 3) + iz('M50 46 V84', M, 4) + e(50, 88, 20, 6, '#C98A4B') + p('M32 14 h36 l14 32 h-64 z', '#FFD23F') + parlak('M40 22 l-6 16'); },
    door: function () { return r(24, 6, 52, 88, 4, '#C98A4B') + r(32, 14, 36, 28, 3) + r(32, 50, 36, 36, 3) + c(66, 52, 4, '#FFD23F') + iz('M10 94 h80', M, 3); },
    window: function () { return r(12, 12, 76, 76, 4, '#BDE8F2') + gunes(32, 32, 7).replace(/stroke-width="4"/, 'stroke-width="2.4"') + iz('M50 12 V88 M12 50 H88', M, 4) + p('M12 12 h14 q-8 38 4 76 h-18 z', '#FF6FA5') + p('M88 12 h-14 q8 38 -4 76 h18 z', '#FF6FA5'); },
    bath: function () { return c(28, 40, 7, '#E8F6FF') + c(42, 34, 9, '#E8F6FF') + c(57, 40, 7, '#E8F6FF') + p('M80 46 v-24 q0 -8 -8 -8 h-8', '') + iz('M60 14 v6', M, 3) + p('M6 46 h88 v8 q0 28 -28 28 h-32 q-28 0 -28 -28 z', '#fff') + iz('M10 54 h80', '#BDE8F2', 4) + iz('M24 82 l-4 8 M76 82 l4 8', M, 4); },
    fridge: function () { return r(24, 6, 52, 88, 7, '#E3F1FF') + iz('M24 36 H76', M, 3) + r(64, 14, 5, 14, 2, '#9AA7BD') + r(64, 44, 5, 22, 2, '#9AA7BD') + c(36, 54, 4.6, '#E5484D') + yildiz(40, 70, 6, '#FFD23F') + r(30, 14, 12, 10, 2, '#4CC38A'); },
    clock: function () { return c(50, 50, 40, '#8E7CF0') + c(50, 50, 31, '#fff') + iz('M50 24 v6 M50 70 v6 M24 50 h6 M70 50 h6', M, 3) + iz('M50 50 V32 M50 50 L64 58', M, 4) + n(50, 50, 4); },
    /* school */
    pencil: function () { return g('rotate(-40 50 50)', r(16, 40, 58, 20, 3, '#FFD23F') + iz('M16 46 h58 M16 54 h58', '#F2B92A', 2.4) + p('M74 40 L94 50 L74 60 Z', '#FFE2BF') + p('M88 47 L94 50 L88 53 Z', M) + r(4, 40, 12, 20, 4, '#FF9EB5') + r(12, 39, 6, 22, 1, '#C7CCD6')); },
    book: function () { return p('M6 30 V88 Q28 82 50 90 Q72 82 94 88 V30', '#4AA8FF') + p('M50 24 q-18 -10 -40 -4 v58 q22 -6 40 4 z', '#fff') + p('M50 24 q18 -10 40 -4 v58 q-22 -6 -40 4 z', '#fff') + iz('M18 36 q12 -3 24 2 M18 48 q12 -3 24 2 M18 60 q12 -3 24 2 M58 38 q12 -5 24 -2 M58 50 q12 -5 24 -2 M58 62 q12 -5 24 -2', '#9AA7BD', 2.4); },
    bag: function () { return p('M40 24 q0 -14 10 -14 q10 0 10 14', '') + r(20, 22, 60, 70, 16, '#E5484D') + p('M20 46 q30 14 60 0', '') + r(32, 60, 36, 24, 8, '#FF7A80') + r(45, 54, 10, 10, 2, '#FFD23F'); },
    ruler: function () { return g('rotate(-28 50 50)', r(2, 38, 96, 24, 3, '#F2B92A') + iz('M12 38 v10 M22 38 v6 M32 38 v10 M42 38 v6 M52 38 v10 M62 38 v6 M72 38 v10 M82 38 v6 M92 38 v10', M, 2.4)); },
    eraser: function () { return p('M14 56 L38 32 H82 L58 56 Z', '#FFC9D4') + p('M58 56 L82 32 V58 L58 82 Z', '#F27FA0') + r(14, 56, 44, 26, 3, '#FF9EB5') + r(30, 56, 12, 26, 0, '#4AA8FF'); },
    crayons: function () { var h = '', k = [['#E5484D', 14], ['#4AA8FF', 40], ['#FFD23F', 66]]; k.forEach(function (x) { h += p('M' + x[1] + ' 32 L' + (x[1] + 10) + ' 10 L' + (x[1] + 20) + ' 32 Z', x[0]) + r(x[1], 32, 20, 58, 3, x[0]) + r(x[1], 46, 20, 14, 0, '#fff') + iz('M' + (x[1] + 5) + ' 53 h10', x[0], 3); }); return h; },
    scissors: function () { return p('M48 54 L82 10 L88 16 Z', '#D5DDEA') + p('M52 54 L18 10 L12 16 Z', '#D5DDEA') + iz('M38 68 L50 52 L62 68', M, 4) + c(32, 76, 12, '#8E7CF0') + c(32, 76, 5.6, '#fff') + c(68, 76, 12, '#8E7CF0') + c(68, 76, 5.6, '#fff') + n(50, 52, 3.6); },
    glue: function () { return p('M46 24 l4 -16 l4 16 z', '#FF8A3D') + p('M38 36 l6 -12 h12 l6 12', '#FF8A3D') + r(28, 36, 44, 56, 8, '#fff') + r(28, 52, 44, 24, 0, '#2EB5A8') + yazi(50, 70, 'GLUE', 12) + damla(80, 14, '#fff'); },
    desk: function () { return r(18, 28, 26, 10, 2, '#4AA8FF') + r(22, 22, 22, 7, 2, '#E5484D') + r(6, 38, 88, 10, 3, '#C98A4B') + r(54, 48, 32, 24, 2, '#E8A85A') + n(70, 60, 2.6) + r(12, 48, 7, 44, 2, '#B07A40') + r(81, 72, 7, 20, 2, '#B07A40'); },
    board: function () { return iz('M26 74 l-6 18 M74 74 l6 18', M, 4) + r(4, 8, 92, 66, 5, '#C98A4B') + r(10, 14, 80, 54, 2, '#2F7D5B') + yazi(34, 40, 'ABC', 16) + iz('M20 52 h44 M20 60 h30', '#fff', 2.6) + r(60, 66, 20, 5, 2, '#fff'); },
    /* weather */
    sunny: function () { return gunes(50, 50, 22); },
    cloudy: function () { return bulut(30, 18, 0.8, '#C7CCD6') + bulut(6, 38, 1.05, '#fff'); },
    rainy: function () { return bulut(10, 12, 1.0, '#fff') + damla(28, 64) + damla(48, 70) + damla(68, 64) + damla(38, 84) + damla(60, 86); },
    windy: function () { return kalin('M8 34 h50 q14 0 14 -12 q0 -10 -10 -10 q-8 0 -8 8', '#BDE8F2', 5) + kalin('M8 54 h66 q12 0 12 12 q0 10 -10 10 q-8 0 -8 -8', '#BDE8F2', 5) + kalin('M8 74 h30', '#BDE8F2', 5) + p('M66 88 q8 -12 22 -8 q-6 14 -22 8 z', '#4CC38A'); },
    snowy: function () { return bulut(10, 10, 1.0, '#fff') + kar(28, 68, 8) + kar(52, 80, 9) + kar(74, 66, 7) + '<circle cx="40" cy="92" r="3" fill="#BDE8F2"/><circle cx="66" cy="94" r="3" fill="#BDE8F2"/>'; },
    stormy: function () { return bulut(10, 10, 1.0, '#8A94A8') + p('M50 52 L38 74 H50 L42 94 L66 66 H54 L62 52 Z', '#FFD23F') + damla(24, 66) + damla(78, 66); },
    rainbow: function () { return hazir('gokkusagi'); },
    hot: function () { return gunes(34, 40, 16) + termometre('#E5484D', 46) + iz('M14 80 q6 -6 0 -12 M28 84 q6 -6 0 -12', '#FF8A3D', 3); },
    cold: function () { return kar(30, 40, 16) + termometre('#4AA8FF', 6) + '<path d="M10 86 h44" stroke="#BDE8F2" stroke-width="6" stroke-linecap="round"/>'; },
    foggy: function () { return '<circle cx="50" cy="34" r="18" fill="#FFE9A0"/>' + kalin('M10 40 q10 -6 20 0 t20 0 t20 0 t20 0', '#E3E8F2', 6) + kalin('M10 60 q10 -6 20 0 t20 0 t20 0 t20 0', '#E3E8F2', 6) + kalin('M10 80 q10 -6 20 0 t20 0 t20 0 t20 0', '#E3E8F2', 6); },
    /* sahne yardımcıları (kelime değil) */
    hediye: function () { return r(16, 42, 68, 48, 4, '#8E7CF0') + r(10, 30, 80, 16, 4, '#B9A8FF') + r(44, 30, 12, 60, 0, '#FFD23F') + p('M50 30 q-20 -22 -26 -8 q0 8 26 8 q26 0 26 -8 q-6 -14 -26 8 z', '#FFD23F'); },
    tencere: function () { return iz('M26 20 q-2 -8 6 -8 M74 20 q2 -8 -6 -8', M, 3) + c(50, 14, 4, '#9AA7BD') + r(14, 30, 72, 52, 10, '#E5484D') + r(10, 22, 80, 10, 4, '#9AA7BD') + iz('M4 46 h10 M86 46 h10', M, 6) + iz('M30 10 q4 -6 0 -10 M60 10 q4 -6 0 -10', '#9AA7BD', 3); },
    tv: function () { return iz('M36 14 l14 12 l14 -12', M, 3) + r(10, 26, 80, 54, 8, '#5B6478') + r(18, 33, 64, 40, 4, '#BDE8F2') + c(40, 52, 7, '#FFD23F') + iz('M52 62 q10 -14 22 0', '#4CC38A', 4) + iz('M30 88 h40', M, 4); },
    dus: function () { return iz('M20 10 v20 q0 8 8 8 h18', M, 4) + p('M40 32 h32 q6 0 6 6 v4 h-44 v-4 q0 -6 6 -6 z', '#9AA7BD') + damla(42, 54) + damla(56, 60) + damla(70, 54) + damla(48, 76) + damla(64, 80); }
  };
  Object.keys(VUCUT).forEach(function (k) { R[k] = (function (s) { return function () { return s; }; })(VUCUT[k]); });
  Object.keys(AILE).forEach(function (k) { R[k] = (function (o) { return function () { return kisi(o); }; })(AILE[k]); });
  ['happy', 'sad', 'angry', 'scared', 'surprised', 'tired', 'hungry', 'excited', 'shy', 'bored', 'proud', 'worried', 'silly', 'brave', 'loved', 'sleepy', 'calm', 'nervous', 'sick', 'thirsty'].forEach(function (k) { R[k] = function () { return yuz(k); }; });

  var onbellek = {};
  function ic(ad) { if (!R[ad]) return ''; if (!(ad in onbellek)) onbellek[ad] = R[ad](); return onbellek[ad]; }
  function ciz(ad, cls) { return '<svg class="kc kc-resim ' + (cls || '') + '" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' + ic(ad) + '</svg>'; }
  /* resimli balon (balon oyunu): renkli balonun ortasında kelimenin resmi */
  function balonResim(ad, renk) {
    return '<svg class="kc kc-balon kc-rbalon" viewBox="0 0 100 150" aria-hidden="true" focusable="false"><path d="M50 104 q-6 22 4 42" fill="none" stroke="' + M + '" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M50 6 c26 0 42 20 42 46 c0 28 -22 52 -42 52 c-20 0 -42 -24 -42 -52 c0 -26 16 -46 42 -46 z" fill="' + renk + '" stroke="' + M + '" stroke-width="3"/><path d="M44 102 h12 l4 9 h-20 z" fill="' + renk + '" stroke="' + M + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<circle cx="50" cy="54" r="36" fill="#fff" opacity=".9"/>' + g('translate(18 22) scale(.64)', ic(ad)) + '<path d="M22 34 q4 -14 16 -18" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/></svg>';
  }

  /* ---------- tema rozeti: madalya + kurdele + konunun simgesi ---------- */
  function rozet(renk, simgeIc, kilitli) {
    var k = kilitli ? '#D5DDEA' : renk;
    return '<svg class="kc kc-rozet' + (kilitli ? ' kc-kilitli' : '') + '" viewBox="0 0 100 120" aria-hidden="true" focusable="false">' +
      '<path d="M30 70 L18 116 L34 108 L42 120 L50 80 Z" fill="' + (kilitli ? '#C7CCD6' : '#E5484D') + '" ' + S + '/><path d="M70 70 L82 116 L66 108 L58 120 L50 80 Z" fill="' + (kilitli ? '#C7CCD6' : '#4AA8FF') + '" ' + S + '/>' +
      yildizYol(50, 48, 46, 38, 14) + ' fill="' + (kilitli ? '#E3E8F2' : '#FFD23F') + '" ' + S + '/>' + c(50, 48, 32, k) + g('translate(25 23) scale(.5)', kilitli ? hazir('kilit') : simgeIc) + '</svg>';
  }

  /* ---------- Simon (My Body) oyununun büyük çocuk figürü: dokunulabilir parçalar ---------- */
  function hedef(sekil) { return sekil.replace(/\/>/g, ' fill-opacity="0" stroke-opacity="0" pointer-events="all"/>'); }
  function beden() {
    var b = function (id, ic_, hit) { return '<g class="ko-parca" data-parca="' + id + '" tabindex="0" role="button" aria-label="' + id + '">' + ic_ + (hit ? hedef(hit) : '') + '</g>'; };
    return '<svg class="kc ko-beden" viewBox="0 0 240 330" role="img" aria-label="Çocuk figürü">' +
      b('legs', kalin('M102 236 V292', '#2E7DD8', 22) + kalin('M138 236 V292', '#2E7DD8', 22), r(84, 230, 72, 66, 0)) +
      b('feet', e(96, 304, 20, 11, '#E5484D') + e(144, 304, 20, 11, '#E5484D'), r(70, 290, 100, 30, 0)) +
      b('arms', kalin('M86 178 Q60 194 48 218', TEN, 18) + kalin('M154 178 Q180 194 192 218', TEN, 18), '') +
      b('neck', r(108, 140, 24, 28, 4, TEN), r(98, 148, 44, 18, 0)) +
      b('tummy', r(78, 160, 84, 86, 26, '#4CC38A') + yildizYol(120, 200, 16, 8, 5) + ' fill="#FFD23F" ' + S + '/>', r(86, 186, 68, 52, 0)) +
      b('shoulders', '<circle cx="90" cy="170" r="7" fill="#7FD9A8"/><circle cx="150" cy="170" r="7" fill="#7FD9A8"/>', c(90, 170, 16) + c(150, 170, 16)) +
      b('knees', e(102, 266, 9, 6, '#7FB7F2') + e(138, 266, 9, 6, '#7FB7F2'), r(86, 256, 68, 20, 0)) +
      b('hands', c(44, 226, 15, TEN) + c(196, 226, 15, TEN), '') +
      b('head', c(120, 92, 62, TEN) + '<circle cx="86" cy="118" r="8" fill="#FF9EB5" opacity=".7"/><circle cx="154" cy="118" r="8" fill="#FF9EB5" opacity=".7"/>', '') +
      b('ears', c(56, 98, 14, TEN) + iz('M52 92 q8 0 8 8', M, 3) + c(184, 98, 14, TEN) + iz('M188 92 q-8 0 -8 8', M, 3), c(56, 98, 20) + c(184, 98, 20)) +
      b('hair', p('M58 86 q-2 -62 62 -62 q64 0 62 62 q-14 -34 -42 -32 q-14 10 -40 6 q-28 -4 -42 26 z', '#8F5A3A'), '') +
      b('eyes', e(98, 92, 10, 12, '#fff') + e(142, 92, 10, 12, '#fff') + n(99, 94, 5.4) + n(143, 94, 5.4) + n(101, 91, 2, '#fff') + n(145, 91, 2, '#fff'), r(80, 74, 80, 36, 0)) +
      b('nose', e(120, 112, 8, 6, '#FFB49A'), c(120, 112, 14)) +
      b('mouth', p('M98 128 q22 22 44 0 z', '#FF6F7D'), r(92, 122, 56, 22, 0)) + '</svg>';
  }
  /* giydirme figürü (Clothes): kıyafetler üstüne yerleşir */
  function giyFigur() {
    return '<svg class="kc ko-giyfig" viewBox="0 0 160 240" aria-hidden="true">' + kalin('M66 170 V222', TEN, 14) + kalin('M94 170 V222', TEN, 14) + kalin('M56 112 Q38 132 32 156', TEN, 12) + kalin('M104 112 Q122 132 128 156', TEN, 12) +
      r(52, 96, 56, 84, 20, '#fff') + c(80, 54, 38, TEN) + p('M44 50 q0 -38 36 -38 q36 0 36 38 q-8 -20 -26 -18 q-10 6 -24 2 q-16 -2 -22 16 z', '#8F5A3A') + n(68, 58, 3.6) + n(92, 58, 3.6) + iz('M70 72 q10 8 20 0', M, 3) + '</svg>';
  }
  /* aile fotoğraf çerçevesi */
  function cerceve() { return '<svg class="kc ko-cerceve-r" viewBox="0 0 200 140" aria-hidden="true" preserveAspectRatio="none"><rect x="4" y="4" width="192" height="132" rx="10" fill="#C98A4B" ' + S + '/><rect x="16" y="16" width="168" height="108" rx="4" fill="#FFF6E2" ' + S + '/></svg>'; }
  function sepet() { return '<svg class="kc ko-kap-r" viewBox="0 0 200 120" aria-hidden="true"><path d="M60 40 q40 -50 80 0" fill="none" stroke="' + M + '" stroke-width="7" stroke-linecap="round"/><path d="M60 40 q40 -50 80 0" fill="none" stroke="#C98A4B" stroke-width="3" stroke-linecap="round"/><path d="M14 40 h172 l-16 74 h-140 z" fill="#E8A85A" ' + S + '/>' + iz('M22 60 h156 M26 80 h148 M30 100 h140', '#C98A4B', 3) + iz('M50 40 l8 74 M80 40 l4 74 M120 40 l-4 74 M150 40 l-8 74', '#C98A4B', 3) + '<path d="M10 34 h180 v10 h-180 z" fill="#FF6FA5" ' + S + '/></svg>'; }
  function kutu() { return '<svg class="kc ko-kap-r" viewBox="0 0 200 120" aria-hidden="true"><path d="M20 30 L4 10 L60 10 L70 30 Z" fill="#6FB8FF" ' + S + '/><path d="M180 30 L196 10 L140 10 L130 30 Z" fill="#6FB8FF" ' + S + '/><rect x="20" y="30" width="160" height="84" rx="6" fill="#4AA8FF" ' + S + '/>' + yildiz(100, 72, 18, '#FFD23F') + yazi(52, 92, 'TOYS', 16) + '</svg>'; }
  function canta() { return '<svg class="kc ko-kap-r" viewBox="0 0 200 130" aria-hidden="true"><path d="M80 24 q0 -20 20 -20 q20 0 20 20" fill="none" ' + S + ' stroke-width="5"/><rect x="30" y="20" width="140" height="106" rx="24" fill="#E5484D" ' + S + '/><path d="M30 52 q70 26 140 0" fill="#FF7A80" ' + S + '/><rect x="90" y="56" width="20" height="16" rx="3" fill="#FFD23F" ' + S + '/></svg>'; }

  /* boyama: çizimin ana rengini (en sık dolgu) verilen renkle değiştir — "three red cars" */
  var DOKUNMA = /^#(23304D|FFF|FFFFFF|FFD9C2|F3D9B5|FFF3DD|FFE2BF)$/i;
  function anaRenk(m) { var say = {}, en = null; (m.match(/fill="#[0-9A-Fa-f]{6}"/g) || []).forEach(function (x) { var h = x.slice(6, 13).toUpperCase(); if (DOKUNMA.test(h)) return; say[h] = (say[h] || 0) + 1; if (!en || say[h] > say[en]) en = h; }); return en; }
  var boyaB = {};
  function boya(ad, hex) { var k = ad + hex; if (boyaB[k]) return boyaB[k]; var m = ic(ad), a = anaRenk(m); return (boyaB[k] = a ? m.replace(new RegExp(a, 'gi'), hex) : m); }
  function boyanir(ad) { return !!anaRenk(ic(ad)); }
  /* çizgi resim (yazdırılabilir boyama sayfası): bütün dolgular beyaz, kontur kalır */
  function cizgi(ad) { return ic(ad).replace(/fill="#(?!23304D)[0-9A-Fa-f]{3,6}"/gi, 'fill="#fff"').replace(/stroke="#(?!23304D)[0-9A-Fa-f]{3,6}"/gi, 'stroke="#23304D"').replace(/ opacity="[^"]*"/g, ''); }
  /* ada dünyaları: her konunun sahne arka planı (gök, zemin, soluk motifler) */
  var DUNYA = {
    colours: ['#FFE9F0', '#FFC9D8', ['gokkusagi', 'firca', 'yildiz']], numbers: ['#E6F8EE', '#B9E8CB', ['yildiz', 'top', 'elma']],
    animals: ['#FFF4D6', '#B7E39A', ['cow', 'chick', 'cat']], family: ['#EEF1FF', '#C9D2FF', ['family', 'ev', 'baby']], body: ['#FFF0E6', '#FFD3BC', ['hands', 'eyes', 'feet']],
    food: ['#FFF0F0', '#FFC9C9', ['apple', 'cake', 'carrot']], toys: ['#EAF6FF', '#BFE3FF', ['ball', 'kite', 'teddy']], clothes: ['#F5EEFF', '#E0CCFF', ['hat', 'tshirt', 'socks']],
    home: ['#F3FBE8', '#D5EDB6', ['lamp', 'sofa', 'clock']], school: ['#FFF8DD', '#FFE59A', ['book', 'pencil', 'bag']], weather: ['#E2F5FB', '#BCE6F2', ['cloudy', 'sunny', 'rainy']],
    feelings: ['#FFEFF6', '#FFCDE2', ['happy', 'loved', 'excited']], fruits: ['#FFF6E5', '#FFDDA0', ['orangefruit', 'pear', 'cherries']], transport: ['#EAF2FF', '#C9D3E6', ['bus', 'plane', 'bike']],
    shapes: ['#F4F0FF', '#DCD2FF', ['circle', 'triangle', 'star']], sea: ['#DDF3FF', '#8FD3F5', ['whale', 'starfish', 'shell']], jobs: ['#FFF3E8', '#FFD9B5', ['doctor', 'chef', 'pilot']],
    actions: ['#EFFAF1', '#C6EDCF', ['run', 'jump', 'dance']], seasons: ['#FFF8E8', '#D7EDB0', ['spring', 'autumn', 'winter']], days: ['#F2F5FF', '#D5DDF7', ['monday', 'friday', 'sunday']],
    places: ['#FFF7EC', '#F2D7B0', ['under', 'in', 'on']], alphabet: ['#F0FAFF', '#CDEBFF', ['harf-a', 'harf-b', 'harf-c']]
  };
  function motif(ad) { return R[ad] ? ic(ad) : icAl(C.simge(ad)); }
  function dunya(kid) {
    var d = DUNYA[kid] || DUNYA.colours, yer = [[18, 30, 0.34], [300, 18, 0.3], [150, 60, 0.24], [330, 150, 0.32], [40, 170, 0.28], [220, 200, 0.3], [110, 120, 0.22], [250, 100, 0.26]];
    return '<svg class="ka-dunya-r" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><rect width="400" height="300" fill="' + d[0] + '"/>' +
      '<path d="M0 236 q60 -26 130 -6 q80 22 150 -4 q70 -24 120 2 V300 H0 Z" fill="' + d[1] + '"/>' +
      yer.map(function (y, i) { return '<g transform="translate(' + y[0] + ' ' + y[1] + ') scale(' + y[2] + ') rotate(' + (i % 2 ? 8 : -8) + ' 50 50)" opacity=".2">' + motif(d[2][i % d[2].length]) + '</g>'; }).join('') + '</svg>';
  }
  function ekle(ad, f) { R[ad] = f; delete onbellek[ad]; }
  W.KIDS_RESIM = { ic: ic, ciz: ciz, boya: boya, boyanir: boyanir, cizgi: cizgi, dunya: dunya, DUNYA: DUNYA, ekle: ekle,
    A: { M: M, S: S, TEN: TEN, p: p, c: c, e: e, r: r, n: n, iz: iz, kalin: kalin, g: g, yazi: yazi, parlak: parlak, yildiz: yildiz, yildizYol: yildizYol, icAl: icAl, hazir: hazir, gunes: gunes, bulut: bulut, damla: damla, kar: kar, termometre: termometre, kisi: kisi, yuz: yuz, AILE: AILE }, var: function (ad) { return !!R[ad]; }, liste: function () { return Object.keys(R); }, balonResim: balonResim, rozet: rozet, beden: beden, giyFigur: giyFigur, cerceve: cerceve, sepet: sepet, kutu: kutu, canta: canta, ADLAR: Object.keys(R) };
})(window);
