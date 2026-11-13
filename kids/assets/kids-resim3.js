/* ==========================================================================
   ACADEX KIDS · üçüncü kat çizimler (kids/assets/kids-resim3.js), 13.11.2026
   22 konunun her birine eklenen yeni kelimelerin çizimleri (~190). Aynı çizim dili
   (KIDS_RESIM.A yardımcıları): lacivert kontur, düz renk, 100x100.
   Tekrar eden biçimler parametreli: yüz ifadeleri, takvim yaprakları, top-kutu
   konumları, taşıt gövdesi, meslek insanı, hareket figürü.
   ========================================================================== */
(function (W) {
  'use strict';
  var RS = W.KIDS_RESIM, C = W.KIDS_CIZ, A = RS.A, M = A.M, TEN = A.TEN;
  var p = A.p, c = A.c, e = A.e, r = A.r, n = A.n, iz = A.iz, kalin = A.kalin, g = A.g, yazi = A.yazi, parlak = A.parlak, yildiz = A.yildiz, yildizYol = A.yildizYol;
  var gunes = A.gunes, bulut = A.bulut, damla = A.damla, kar = A.kar, kisi = A.kisi, icAl = A.icAl, hazir = A.hazir;
  function goz(x1, x2, y, k) { k = k || 3.6; return n(x1, y, k) + n(x2, y, k) + n(x1 + 1.2, y - 1.3, k * 0.38, '#fff') + n(x2 + 1.2, y - 1.3, k * 0.38, '#fff'); }
  function gul(x, y, w) { return iz('M' + (x - w) + ' ' + y + ' q' + w + ' ' + (w * 0.8) + ' ' + (w * 2) + ' 0', M, 3); }
  function ic(ad) { return RS.ic(ad) || icAl(C.simge(ad)); }
  function teker(x, y, k) { return c(x, y, k, M) + c(x, y, k * 0.45, '#C7CCD6'); }
  function yaprak(x, y, rot, f) { return g('translate(' + x + ' ' + y + ') rotate(' + (rot || 0) + ')', p('M0 0 q10 -12 22 -6 q-8 14 -22 6 z', f || '#4CC38A')); }
  var D = {};

  /* ---------------- Animals ---------------- */
  D.penguin = function () { return e(50, 56, 28, 38, M) + e(50, 62, 18, 28, '#fff') + p('M44 34 l6 6 l6 -6 z', '#FF8A3D') + goz(42, 58, 28, 3) + p('M22 60 q-10 10 -4 22 q8 -6 8 -16 z', M) + p('M78 60 q10 10 4 22 q-8 -6 -8 -16 z', M) + e(40, 94, 9, 4, '#FF8A3D') + e(60, 94, 9, 4, '#FF8A3D'); };
  D.owl = function () { return p('M20 30 l10 -18 l10 14 h20 l10 -14 l10 18 v40 q0 26 -30 26 q-30 0 -30 -26 z', '#B07A40') + e(50, 74, 18, 18, '#F3D9B5') + c(36, 42, 13, '#fff') + c(64, 42, 13, '#fff') + n(36, 42, 6) + n(64, 42, 6) + n(38, 40, 2, '#fff') + n(66, 40, 2, '#fff') + p('M46 54 l4 8 l4 -8 z', '#FF8A3D') + iz('M44 70 q6 4 12 0 M44 80 q6 4 12 0', '#D9B37A', 2.4); };
  D.bee = function () { return e(30, 34, 14, 10, '#E3F4FF') + e(54, 30, 14, 10, '#E3F4FF') + e(50, 58, 30, 22, '#FFD23F') + p('M36 38 q-4 20 0 40 h10 q-4 -20 0 -40 z', M) + p('M56 38 q-4 20 0 40 h8 q-4 -20 0 -40 z', M) + c(82, 56, 12, M) + n(85, 53, 2.4, '#fff') + iz('M80 44 q-4 -10 2 -16 M86 46 q2 -10 10 -12', M, 2.4) + p('M18 58 l-10 0 l10 4 z', M); };
  D.butterfly = function () { return p('M50 50 q-30 -40 -42 -12 q-6 20 42 16 z', '#FF6FA5') + p('M50 50 q30 -40 42 -12 q6 20 -42 16 z', '#FF6FA5') + p('M50 54 q-30 30 -36 10 q0 -12 36 -14 z', '#8E7CF0') + p('M50 54 q30 30 36 10 q0 -12 -36 -14 z', '#8E7CF0') + c(30, 36, 5, '#FFD23F') + c(70, 36, 5, '#FFD23F') + e(50, 54, 5, 22, M) + iz('M48 32 q-4 -12 -10 -14 M52 32 q4 -12 10 -14', M, 2.4); };
  D.panda = function () { return icAl(C.avatar('panda')); };
  D.fox = function () { return icAl(C.avatar('tilki')); };
  D.goat = function () { return iz('M36 24 q-6 -14 -16 -14 M64 24 q6 -14 16 -14', '#B07A40', 5) + e(20, 40, 10, 5, '#E3E8F2') + e(80, 40, 10, 5, '#E3E8F2') + e(50, 46, 22, 26, '#F3F5F9') + e(50, 64, 14, 12, '#E3E8F2') + n(45, 64, 2.4) + n(55, 64, 2.4) + goz(41, 59, 42, 3.4) + p('M44 74 q6 18 12 0', '#F3F5F9'); };
  D.hen = function () { return p('M26 70 q-14 -30 14 -40 q2 -14 14 -14 q12 0 14 16 q20 4 20 26 q0 28 -32 28 q-22 0 -30 -16 z', '#fff') + p('M48 14 q4 -10 10 -4 q6 -6 8 4 z', '#E5484D') + p('M70 32 l12 4 l-12 4 z', '#FF8A3D') + p('M66 42 q4 8 -2 10 q-4 -4 2 -10 z', '#E5484D') + n(62, 30, 2.8) + iz('M30 62 q14 -4 22 6', '#E3E8F2', 4) + iz('M44 88 v8 M56 88 v8', '#FF8A3D', 3); };
  D.crocodile = function () { return p('M6 60 q0 -18 22 -20 h40 q24 0 26 18 q-14 0 -26 4 h-40 q-22 0 -22 -2 z', '#3FB86A') + p('M6 62 q20 8 40 6 h48 q-6 12 -30 12 h-36 q-18 0 -22 -18 z', '#5CC97B') + p('M30 66 l4 4 l4 -4 l4 4 l4 -4 l4 4 l4 -4 l4 4 l4 -4', '#fff') + c(28, 36, 7, '#3FB86A') + n(29, 35, 3) + p('M50 40 l4 -6 l4 6 l4 -6 l4 6', '#2E9D62'); };
  D.hippo = function () { return c(28, 26, 7, '#B9A8D8') + c(72, 26, 7, '#B9A8D8') + e(50, 42, 30, 22, '#B9A8D8') + e(50, 68, 36, 22, '#C9BBE5') + e(36, 66, 4, 6, M) + e(64, 66, 4, 6, M) + goz(38, 62, 38, 3.4) + r(40, 82, 6, 8, 2, '#fff') + r(54, 82, 6, 8, 2, '#fff'); };
  D.squirrel = function () { return p('M66 90 q30 -10 24 -46 q-6 -30 -30 -24 q14 10 10 28 q-4 24 -4 42 z', '#D9893A') + e(40, 66, 20, 24, '#E8A85A') + e(40, 72, 10, 14, '#FFE2BF') + c(42, 34, 16, '#E8A85A') + p('M30 22 l2 -12 l8 8 z', '#E8A85A') + p('M52 22 l2 -12 l6 10 z', '#E8A85A') + goz(36, 48, 32, 2.8) + n(42, 40, 2) + c(30, 62, 6, '#8F5A3A'); };

  /* ---------------- Family ---------------- */
  D.me = function () { return icAl(C.avatar('ayi')) + yildiz(82, 16, 9, '#FFD23F'); };
  D.son = function () { return kisi({ stil: 'diken', sac: '#8F5A3A', ust: '#2E8FE8', olcek: 0.86 }); };
  D.daughter = function () { return kisi({ stil: 'uzun', sac: '#3B2A22', ust: '#FF9F45', olcek: 0.86, toka: '#8E7CF0' }); };
  D.children = function () { return g('translate(-18 18) scale(.62)', kisi({ stil: 'kuyruk', sac: '#C9773A', ust: '#FF6FA5' })) + g('translate(19 10) scale(.62)', kisi({ stil: 'diken', sac: '#3B2A22', ust: '#4CC38A' })) + g('translate(56 18) scale(.62)', kisi({ stil: 'kivircik', sac: '#3B2A22', ust: '#FFD23F' })); };
  D.people = function () { return g('translate(-14 4) scale(.6)', kisi({ stil: 'kisa', sac: '#5B3A22', ust: '#5B6478' })) + g('translate(22 -2) scale(.6)', kisi({ stil: 'uzun', sac: '#C9773A', ust: '#2EB5A8' })) + g('translate(56 4) scale(.6)', kisi({ stil: 'topuz', sac: '#C7CCD6', ust: '#B58AE0' })) + g('translate(4 36) scale(.6)', kisi({ stil: 'diken', sac: '#3B2A22', ust: '#E5484D' })) + g('translate(38 36) scale(.6)', kisi({ stil: 'kuyruk', sac: '#8F5A3A', ust: '#FFD23F' })); };
  D.neighbour = function () { return r(60, 30, 34, 60, 3, '#C98A4B') + c(66, 62, 2.6, '#FFD23F') + p('M56 30 l21 -16 l21 16 z', '#E5484D') + g('translate(-8 10) scale(.8)', kisi({ stil: 'kisa', sac: '#8F5A3A', ust: '#4CC38A' })) + iz('M18 50 l-8 -10', TEN, 6); };

  /* ---------------- My Body ---------------- */
  function yuzT(ek, isaret) { return c(50, 50, 34, TEN) + p('M16 44 q0 -32 34 -32 q34 0 34 32 q-10 -14 -24 -12 q-12 8 -44 12 z', '#8F5A3A') + goz(38, 62, 48, 3.4) + (ek || gul(42, 66, 8)) + (isaret ? c(isaret[0], isaret[1], isaret[2], 'none').replace('stroke-width="3"', 'stroke-width="4" stroke-dasharray="6 4"').replace(M, '#E5484D') : ''); }
  D.chin = function () { return yuzT('', [50, 78, 10]); };
  D.eyebrows = function () { return yuzT(gul(42, 66, 8) + iz('M30 36 q8 -6 16 0 M54 36 q8 -6 16 0', '#5B3A22', 5)) + c(50, 36, 26, 'none').replace('stroke-width="3"', 'stroke-width="3" stroke-dasharray="6 4"').replace(M, '#E5484D'); };
  D.lips = function () { return p('M14 50 q18 -20 36 -8 q18 -12 36 8 q-18 22 -36 22 q-18 0 -36 -22 z', '#F0607A') + iz('M16 50 q34 6 68 0', '#B8333A', 3) + parlak('M30 44 q6 -4 10 -2'); };
  D.thumb = function () { return r(26, 42, 44, 46, 16, TEN) + p('M54 46 q2 -36 14 -36 q10 0 8 16 l-4 26', TEN) + iz('M34 54 h28 M34 64 h28 M34 74 h28', '#F2B39A', 2.4) + e(68, 18, 5, 4, '#FFE6D6'); };
  D.nails = function () { return r(18, 30, 12, 50, 6, TEN) + r(34, 22, 12, 58, 6, TEN) + r(50, 22, 12, 58, 6, TEN) + r(66, 30, 12, 50, 6, TEN) + r(19, 31, 10, 10, 4, '#FF6FA5') + r(35, 23, 10, 10, 4, '#8E7CF0') + r(51, 23, 10, 10, 4, '#4AA8FF') + r(67, 31, 10, 10, 4, '#FFD23F') + r(14, 70, 68, 26, 10, TEN); };
  D.elbow = function () { return kalin('M14 86 L44 52 L86 64', TEN, 16) + p('M4 96 l14 -20 l12 8 l-10 18 z', '#4CC38A') + c(44, 52, 9, '#FFC2A1') + c(90, 64, 8, TEN) + iz('M38 38 a16 16 0 0 1 20 6', '#E5484D', 3); };
  D.back = function () { return p('M18 98 q0 -40 32 -40 q32 0 32 40 z', '#4AA8FF') + iz('M50 62 v32', '#2E7DD8', 3) + c(50, 40, 22, '#8F5A3A') + c(28, 44, 5, TEN) + c(72, 44, 5, TEN) + iz('M34 32 q16 -10 32 0', '#B9784C', 3); };

  /* ---------------- Food ---------------- */
  D.burger = function () { return p('M14 44 q0 -30 36 -30 q36 0 36 30 z', '#E8A85A') + '<circle cx="36" cy="26" r="1.6" fill="#fff"/><circle cx="50" cy="22" r="1.6" fill="#fff"/><circle cx="62" cy="28" r="1.6" fill="#fff"/>' + iz('M12 50 q8 6 16 0 t16 0 t16 0 t16 0 t16 0', '#4CC38A', 6) + r(12, 54, 76, 12, 5, '#8F5A3A') + r(14, 64, 72, 6, 2, '#FFD23F') + p('M14 72 h72 q0 16 -36 16 q-36 0 -36 -16 z', '#E8A85A'); };
  D.chips = function () { return [20, 30, 40, 50, 60, 70].map(function (x, i) { return r(x, 10 + (i % 3) * 6, 8, 44, 2, '#FFD23F'); }).join('') + p('M14 40 h72 l-8 52 h-56 z', '#E5484D') + yildiz(50, 64, 10, '#FFD23F'); };
  D.salad = function () { return p('M24 46 q-8 -18 10 -20 q4 -14 18 -8 q12 -10 22 4 q16 2 10 22 z', '#4CC38A') + c(40, 36, 6, '#E5484D') + c(62, 32, 5, '#E5484D') + p('M10 46 h80 q0 40 -40 40 q-40 0 -40 -40 z', '#fff') + iz('M22 58 q28 10 56 0', '#BDE8F2', 3); };
  D.tomato = function () { return c(50, 56, 34, '#E5484D') + p('M50 24 l-10 -8 l8 2 l2 -10 l2 10 l8 -2 z', '#4CC38A') + parlak('M30 44 q4 -10 14 -14'); };
  D.potato = function () { return p('M14 52 q0 -28 36 -30 q38 -2 38 26 q0 30 -38 32 q-36 0 -36 -28 z', '#D9A35E') + n(34, 44, 2, '#A8743A') + n(60, 40, 2, '#A8743A') + n(50, 62, 2, '#A8743A') + n(72, 58, 2, '#A8743A'); };
  D.corn = function () { return p('M50 92 q-26 -20 -22 -60 q8 20 22 40 z', '#4CC38A') + p('M50 92 q26 -20 22 -60 q-8 20 -22 40 z', '#3FB86A') + e(50, 46, 14, 36, '#FFD23F') + iz('M40 28 h20 M37 40 h26 M37 52 h26 M39 64 h22 M50 12 v66', '#E8B820', 2.4); };
  D.pancake = function () { return e(50, 74, 40, 12, '#fff') + e(50, 64, 36, 9, '#E8A85A') + e(50, 54, 36, 9, '#E8A85A') + e(50, 44, 36, 9, '#E8A85A') + p('M30 42 q20 -8 40 0 q-4 16 -10 6 q-6 10 -10 0 q-6 8 -10 -2 z', '#FFB020') + r(44, 30, 12, 10, 2, '#FFF3B0'); };
  D.yoghurt = function () { return p('M26 30 h48 l-6 60 h-36 z', '#fff') + r(22, 22, 56, 10, 3, '#FF9EB5') + r(30, 50, 40, 18, 0, '#FFB3CF') + yazi(50, 64, 'YUM', 10, '#fff') + iz('M70 6 l-10 30', '#C7CCD6', 4); };
  D.popcorn = function () { return [[34, 28], [50, 22], [66, 28], [42, 16], [58, 14], [28, 40], [72, 40]].map(function (x) { return c(x[0], x[1], 9, '#FFF6DB'); }).join('') + p('M22 40 h56 l-8 54 h-40 z', '#fff') + iz('M32 40 l4 54 M50 40 v54 M68 40 l-4 54', '#E5484D', 6); };
  D.sweets = function () { return [[30, 40, '#FF6FA5'], [62, 36, '#4AA8FF'], [46, 68, '#FFD23F']].map(function (x) { return g('translate(' + x[0] + ' ' + x[1] + ')', p('M-22 -10 l12 10 l-12 10 z M22 -10 l-12 10 l12 10 z', x[2]) + c(0, 0, 12, x[2]) + iz('M-6 -6 q6 6 0 12 M2 -8 q6 8 0 16', '#fff', 2.4)); }).join(''); };
  D.lollipop = function () { return r(46, 52, 8, 44, 3, '#fff') + c(50, 36, 26, '#FF6FA5') + iz('M50 36 m-18 0 a18 18 0 1 1 18 18 a12 12 0 1 1 -12 -12 a6 6 0 1 1 6 6', '#fff', 4); };
  D.sausage = function () { return p('M8 60 q-2 -14 14 -16 q28 -8 56 0 q16 2 14 16 q-2 12 -14 12 q-28 6 -56 0 q-14 -2 -14 -12 z', '#C9612A') + iz('M24 54 q26 -6 52 0', '#E8875A', 3) + iz('M18 60 q8 -4 16 0 t16 0 t16 0 t16 0', '#FFD23F', 3); };

  /* ---------------- Toys ---------------- */
  D.spintop = function () { return p('M50 92 L16 50 q34 -24 68 0 Z', '#E5484D') + p('M20 54 q30 -16 60 0', '#FFD23F') + r(44, 18, 12, 26, 4, '#4AA8FF') + iz('M18 50 h64', M, 3) + iz('M6 70 q6 -6 12 0 M82 70 q6 -6 12 0', '#9AA7BD', 3); };
  D.swing = function () { return iz('M10 92 L24 8 L76 8 L90 92', '#C98A4B', 6) + iz('M38 10 V64 M62 10 V64', M, 2.6) + r(32, 62, 36, 8, 3, '#E5484D') + c(50, 44, 9, TEN); };
  D.slide = function () { return iz('M20 92 V20 M36 92 V20', '#9AA7BD', 5) + iz('M20 34 h16 M20 50 h16 M20 66 h16 M20 82 h16', '#9AA7BD', 4) + p('M36 20 q20 4 30 34 q10 30 28 34 v6 q-24 0 -34 -34 q-8 -28 -24 -32 z', '#FFD23F'); };
  D.bucket = function () { return iz('M24 34 q26 -30 52 0', M, 3) + p('M20 34 h60 l-8 56 h-44 z', '#4AA8FF') + iz('M22 46 h56', '#fff', 4) + g('rotate(30 80 30)', r(76, 6, 6, 40, 2, '#C98A4B') + p('M70 44 h18 l-4 14 h-10 z', '#FFD23F')); };
  D.rockinghorse = function () { return p('M8 84 q42 20 84 0', '#C98A4B') + iz('M26 88 L34 60 M70 88 L64 60', '#B07A40', 5) + r(28, 46, 44, 18, 9, '#FF8A3D') + p('M66 50 l8 -26 q10 -6 16 6 l-4 8 h-8 l-4 16 z', '#FF8A3D') + p('M70 26 q-6 -6 0 -12 q6 2 6 10', '#5B3A22') + n(80, 30, 2.4) + iz('M28 50 q-14 8 -10 22', '#5B3A22', 4); };
  D.toyboat = function () { return iz('M4 88 q12 -6 24 0 t24 0 t24 0 t24 0', '#4AA8FF', 3) + iz('M50 70 V12', M, 3) + p('M52 14 l30 40 h-30 z', '#fff') + p('M48 22 l-24 32 h24 z', '#FFD23F') + p('M10 64 h80 l-12 18 h-56 z', '#E5484D'); };
  D.guitar = function () { return g('rotate(30 50 50)', r(44, 2, 12, 46, 3, '#8F5A3A') + p('M50 44 q-24 -2 -24 20 q0 10 8 14 q-10 8 -2 18 q8 8 18 6 q10 2 18 -6 q8 -10 -2 -18 q8 -4 8 -14 q0 -22 -24 -20 z', '#FF8A3D') + c(50, 70, 7, M) + iz('M47 4 v80 M53 4 v80', '#fff', 1.4)); };
  D.trumpet = function () { return p('M70 32 q20 -14 22 18 q-2 32 -22 18 z', '#FFD23F') + r(14, 44, 58, 12, 4, '#FFD23F') + r(30, 30, 6, 14, 2, '#E8B820') + r(40, 30, 6, 14, 2, '#E8B820') + r(50, 30, 6, 14, 2, '#E8B820') + r(6, 44, 10, 12, 3, '#E8B820') + g('translate(76 64) scale(.2)', hazir('nota')); };
  D.rope = function () { return iz('M20 78 q30 -90 60 0', '#E5484D', 4) + r(10, 74, 12, 22, 5, '#4AA8FF') + r(78, 74, 12, 22, 5, '#4AA8FF'); };

  /* ---------------- Clothes ---------------- */
  D.shirt = function () { return p('M34 14 L16 22 L8 56 L22 60 L26 44 V90 H74 V44 L78 60 L92 56 L84 22 L66 14 L50 26 Z', '#FFFFFF') + p('M34 14 L42 30 L50 26 L58 30 L66 14', '#E3F1FF') + iz('M50 26 V90', M, 2) + n(54, 40, 2) + n(54, 54, 2) + n(54, 68, 2) + r(30, 40, 12, 10, 2, '#4AA8FF'); };
  D.jeans = function () { return p('M26 10 H74 L82 92 H58 L50 40 L42 92 H18 Z', '#3B6FB6') + iz('M26 20 H74', '#F2B92A', 2) + iz('M30 26 q8 8 16 0 M54 26 q8 8 16 0', '#F2B92A', 2) + iz('M50 20 V40', '#F2B92A', 2); };
  D.raincoat = function () { return p('M36 16 L20 24 L12 86 H30 V92 H70 V86 H88 L80 24 L64 16 Q50 26 36 16 Z', '#FFD23F') + p('M36 16 q14 -14 28 0 q-14 10 -28 0 z', '#E8B820') + iz('M50 26 V92', M, 2.4) + damla(16, 6) + damla(84, 4); };
  D.slippers = function () { var t = p('M10 74 q0 -18 18 -18 h20 q16 0 16 14 v10 h-54 z', '#FF9EB5') + p('M22 56 q16 -10 30 0 v10 h-30 z', '#FFC9D4') + c(36, 54, 5, '#fff'); return g('translate(30 -18)', t) + t; };
  D.tie = function () { return p('M40 10 h20 l-4 12 h-12 z', '#E5484D') + p('M44 22 h12 l10 50 l-16 20 l-16 -20 z', '#E5484D') + iz('M46 34 l10 8 M44 50 l16 10', '#fff', 3); };
  D.watch = function () { return r(38, 4, 24, 92, 8, '#8F5A3A') + c(50, 50, 22, '#FFD23F') + c(50, 50, 16, '#fff') + iz('M50 50 V40 M50 50 L58 54', M, 3) + n(50, 50, 2.2); };
  D.necklace = function () { return iz('M14 18 q36 70 72 0', M, 2.4) + [[20, 32], [28, 44], [38, 52], [62, 52], [72, 44], [80, 32]].map(function (x, i) { return c(x[0], x[1], 4.6, ['#FF6FA5', '#4AA8FF', '#FFD23F'][i % 3]); }).join('') + p('M50 58 l-10 12 l10 14 l10 -14 z', '#8E7CF0'); };
  D.helmet = function () { return p('M12 64 q0 -46 38 -46 q38 0 38 46 z', '#E5484D') + p('M12 64 h76 v8 h-76 z', '#B8333A') + iz('M30 30 l10 22 M50 20 v32 M70 30 l-10 22', '#fff', 4) + iz('M24 72 q0 14 10 18 M76 72 q0 14 -10 18', M, 3); };
  D.apron = function () { return iz('M34 12 q16 -8 32 0', M, 3) + p('M34 12 h32 v20 l12 4 v54 h-56 v-54 l12 -4 z', '#2EB5A8') + r(36, 52, 28, 18, 4, '#5CD4C4') + iz('M22 40 l-12 8 M78 40 l12 8', M, 3); };
  D.ribbon = function () { return p('M50 50 L14 26 q-6 24 0 48 z', '#FF6FA5') + p('M50 50 L86 26 q6 24 0 48 z', '#FF6FA5') + c(50, 50, 9, '#FF3F86') + p('M46 58 l-10 32 l8 -4 l6 6 z M54 58 l10 32 l-8 -4 l-6 6 z', '#FF6FA5'); };

  /* ---------------- My Home ---------------- */
  function oda(arka, zemin, icAd) { return r(6, 10, 88, 80, 6, arka) + p('M6 70 h88 v14 q0 6 -6 6 h-76 q-6 0 -6 -6 z', zemin) + g('translate(26 22) scale(.48)', ic(icAd)); }
  D.kitchen = function () { return oda('#FFE7D1', '#E8A85A', 'cooker'); };
  D.bathroom = function () { return oda('#DDF3FF', '#7FCBEA', 'bath'); };
  D.bedroom = function () { return oda('#EEE8FF', '#B9A8FF', 'bed'); };
  D.livingroom = function () { return oda('#E9F7E2', '#C98A4B', 'sofa'); };
  D.garden = function () { return p('M2 64 q48 -16 96 0 v34 h-96 z', '#9ED35A') + iz('M8 64 V40 M20 64 V40 M32 64 V40 M44 64 V40 M56 64 V40 M68 64 V40 M80 64 V40 M92 64 V40 M4 46 h92', '#C98A4B', 4) + g('translate(10 64) scale(.24)', hazir('cicek')) + g('translate(64 62) scale(.26)', hazir('cicek')) + gunes(80, 18, 8); };
  D.roof = function () { return p('M4 54 L50 10 L96 54 Z', '#E5484D') + iz('M20 40 h60 M30 30 h40', '#B8333A', 3) + r(68, 14, 12, 20, 2, '#C98A4B') + r(16, 54, 68, 38, 2, '#FFF3DD') + r(42, 66, 16, 26, 2, '#C98A4B'); };
  D.key = function () { return c(28, 40, 18, '#FFD23F') + c(28, 40, 7, '#fff') + r(44, 36, 46, 9, 3, '#FFD23F') + r(72, 44, 7, 12, 1, '#FFD23F') + r(84, 44, 6, 10, 1, '#FFD23F'); };
  D.phone = function () { return r(28, 6, 44, 88, 10, '#5B6478') + r(33, 16, 34, 62, 3, '#BDE8F2') + c(50, 86, 4, '#C7CCD6') + g('translate(38 30) scale(.24)', hazir('kedi')); };
  D.shelf = function () { return r(10, 30, 80, 6, 2, '#C98A4B') + r(10, 70, 80, 6, 2, '#C98A4B') + r(16, 8, 10, 22, 2, '#4AA8FF') + r(28, 12, 10, 18, 2, '#E5484D') + r(40, 10, 8, 20, 2, '#FFD23F') + g('translate(58 6) scale(.24)', ic('plant')) + r(16, 48, 24, 22, 3, '#8E7CF0') + c(66, 60, 10, '#FF9F45'); };
  D.curtains = function () { return iz('M6 10 h88', M, 4) + r(20, 14, 60, 76, 2, '#BDE8F2') + p('M8 12 h22 q-10 40 6 80 h-28 z', '#8E7CF0') + p('M92 12 h-22 q10 40 -6 80 h28 z', '#8E7CF0') + iz('M14 20 q4 30 0 60 M86 20 q-4 30 0 60', '#B9A8FF', 3); };

  /* ---------------- School ---------------- */
  D.pencilcase = function () { return r(8, 36, 84, 40, 14, '#8E7CF0') + iz('M14 44 h72', '#FFD23F', 4) + r(84, 38, 8, 10, 3, '#FFD23F') + g('rotate(-10 30 30)', r(20, 22, 40, 8, 2, '#FFD23F')) + r(56, 24, 30, 8, 2, '#E5484D'); };
  D.marker = function () { return g('rotate(-40 50 50)', r(16, 38, 54, 24, 6, '#3FB86A') + r(16, 38, 18, 24, 6, '#2E9D62') + p('M70 42 L86 50 L70 58 Z', '#3FB86A')) + iz('M18 88 q20 -10 40 0 t30 -4', '#3FB86A', 5); };
  D.map = function () { return p('M8 20 l26 -8 l32 10 l26 -8 v68 l-26 8 l-32 -10 l-26 8 z', '#FFF3DD') + iz('M34 12 v68 M66 22 v68', '#E3D9BD', 2.4) + p('M16 40 q10 -10 18 0 q-2 14 -12 12 z', '#4CC38A') + p('M48 50 q12 -14 22 0 q0 12 -14 14 z', '#4CC38A') + iz('M20 70 q20 -20 40 -10 t28 -24', '#E5484D', 3).replace('stroke-linecap="round"', 'stroke-dasharray="4 4" stroke-linecap="round"') + p('M80 30 l4 -6 l4 6 l-4 6 z', '#E5484D'); };
  D.calculator = function () { return r(22, 6, 56, 88, 8, '#5B6478') + r(28, 14, 44, 18, 3, '#BDE8F2') + yazi(58, 28, '123', 11, M) + [0, 1, 2].map(function (i) { return [0, 1, 2, 3].map(function (j) { return r(29 + i * 15, 40 + j * 12, 11, 8, 2, j === 3 && i === 2 ? '#FF8A3D' : '#fff'); }).join(''); }).join(''); };
  D.bell = function () { return p('M50 10 q24 0 24 30 v20 l8 12 h-64 l8 -12 v-20 q0 -30 24 -30 z', '#FFD23F') + c(50, 80, 7, '#E8B820') + r(46, 4, 8, 8, 3, '#E8B820') + iz('M12 30 q-6 10 0 20 M88 30 q6 10 0 20', '#9AA7BD', 3); };
  D.playground = function () { return p('M2 80 q48 -10 96 0 v18 h-96 z', '#9ED35A') + g('translate(-2 10) scale(.56)', ic('slide')) + g('translate(44 10) scale(.56)', ic('swing')); };
  D.classroom = function () { return r(6, 8, 88, 84, 6, '#FFF8E7') + g('translate(22 12) scale(.56)', ic('board')) + r(14, 70, 26, 8, 2, '#C98A4B') + r(60, 70, 26, 8, 2, '#C98A4B') + iz('M18 78 v12 M36 78 v12 M64 78 v12 M82 78 v12', '#B07A40', 3); };
  D.tape = function () { return c(50, 50, 34, '#E8B820') + c(50, 50, 16, '#FFF8E7') + p('M76 66 l18 12 l-6 6 l-16 -12', '#FFE27A'); };
  D.sticker = function () { return p('M14 14 h72 v52 l-20 20 h-52 z', '#fff') + p('M86 66 h-20 v20 z', '#E3E8F2') + yildiz(48, 46, 22, '#FFD23F') + goz(43, 53, 46, 2.4); };
  D.magnifier = function () { return iz('M62 62 L90 90', '#8F5A3A', 10) + c(40, 40, 28, '#DDF3FF') + iz('M24 32 q4 -10 14 -12', '#fff', 5); };

  /* ---------------- Weather ---------------- */
  D.thunder = function () { return A.bulut(10, 8, 1.0, '#5B6478') + p('M46 50 L34 72 H46 L38 94 L62 64 H50 L58 50 Z', '#FFD23F') + iz('M14 62 q-6 6 0 12 M86 62 q6 6 0 12', '#FFD23F', 3); };
  D.moon = function () { return p('M58 10 a40 40 0 1 0 32 64 a32 32 0 1 1 -32 -64 z', '#FFE27A') + n(40, 46, 3) + iz('M38 60 q6 4 12 0', M, 2.6) + c(32, 34, 4, '#F2C94C'); };
  D.nightsky = function () { return r(4, 4, 92, 92, 14, '#2E3F6E') + p('M66 14 a18 18 0 1 0 14 28 a14 14 0 1 1 -14 -28 z', '#FFE27A') + yildiz(24, 24, 7, '#FFD23F') + yildiz(40, 60, 5, '#FFD23F') + yildiz(70, 72, 6, '#FFD23F') + yildiz(20, 80, 4, '#FFD23F'); };
  D.sunrise = function () { return r(4, 4, 92, 92, 14, '#FFD9B5') + gunes(50, 66, 18) + p('M4 66 h92 v16 q0 14 -14 14 h-64 q-14 0 -14 -14 z', '#4CC38A') + iz('M10 30 q8 -4 16 0 M70 20 q8 -4 16 0', '#fff', 3); };
  D.tornado = function () { return [[10, 18, 80], [18, 32, 64], [26, 46, 48], [32, 60, 36], [38, 74, 24], [44, 86, 12]].map(function (x) { return e(50 + (x[0] % 3) * 2, x[1], x[2] / 2, 6, '#C7CCD6'); }).join('') + yaprak(76, 48, 30) + yaprak(20, 70, -20); };
  D.warm = function () { return gunes(50, 40, 18) + iz('M20 78 q6 -6 0 -12 M40 82 q6 -6 0 -12 M60 82 q6 -6 0 -12 M80 78 q6 -6 0 -12', '#FF8A3D', 3); };
  D.hail = function () { return A.bulut(10, 8, 1.0, '#C7CCD6') + [[24, 64], [44, 72], [64, 64], [34, 86], [56, 88], [76, 82]].map(function (x) { return c(x[0], x[1], 4.6, '#fff'); }).join(''); };
  D.wet = function () { return yuzF('sad', damla(20, 6) + damla(40, 0) + damla(64, 4) + damla(82, 10)); };

  /* ---------------- Feelings (yeni yüzler) ---------------- */
  function yuzF(d, ek) {
    var h = c(50, 52, 40, d === 'hurt' ? '#FFD9A0' : '#FFD84D'), go = goz(36, 64, 46, 4.4), ag = gul(42, 66, 8);
    if (d === 'lonely') { go = goz(36, 64, 50, 3.6); ag = iz('M40 72 q10 -6 20 0', M, 3); ek = (ek || '') + iz('M28 38 l10 -2 M72 38 l-10 -2', M, 3); }
    if (d === 'confused') { go = c(36, 46, 6, '#fff') + n(36, 46, 3) + iz('M58 46 h12', M, 3.4); ag = iz('M38 68 q6 -6 12 0 q6 6 12 0', M, 3); ek = (ek || '') + yazi(84, 24, '?', 22, '#8E7CF0'); }
    if (d === 'curious') { go = c(36, 46, 7, '#fff') + c(64, 46, 7, '#fff') + n(39, 46, 3.4) + n(67, 46, 3.4); ag = e(50, 68, 5, 4, '#7A2F3A'); ek = (ek || '') + iz('M28 32 q8 -8 16 -2 M56 30 q8 -6 16 2', M, 3); }
    if (d === 'grumpy') { go = iz('M28 44 h14 M58 44 h14', M, 3.4) + iz('M26 34 l16 6 M74 34 l-16 6', M, 3.4); ag = iz('M36 70 q14 -10 28 0', M, 3.6); }
    if (d === 'embarrassed') { go = iz('M30 46 q6 -4 12 0 M58 46 q6 -4 12 0', M, 3); ag = iz('M44 66 q6 -3 12 0', M, 3); ek = (ek || '') + '<ellipse cx="28" cy="58" rx="9" ry="6" fill="#FF6FA5" opacity=".8"/><ellipse cx="72" cy="58" rx="9" ry="6" fill="#FF6FA5" opacity=".8"/>' + damla(80, 22, '#BDE8F2'); }
    if (d === 'hurt') { go = iz('M30 44 l10 4 M70 44 l-10 4', M, 3.4); ag = iz('M38 70 q12 -8 24 0', M, 3.2); ek = (ek || '') + g('rotate(-30 70 30)', r(56, 24, 30, 12, 6, '#FFC2A1') + r(66, 24, 10, 12, 0, '#FFE6D6')); }
    if (d === 'sad') { go = goz(36, 64, 46, 4) + iz('M28 36 l12 -4 M72 36 l-12 -4', M, 3); ag = iz('M36 72 q14 -12 28 0', M, 3.4); }
    return h + go + ag + (ek || '');
  }
  ['lonely', 'confused', 'curious', 'grumpy', 'embarrassed', 'hurt'].forEach(function (k) { D[k] = function () { return yuzF(k); }; });

  /* ---------------- Fruits ---------------- */
  function meyve(f, ek, k) { return c(50, 56, k || 32, f) + iz('M50 24 q2 -8 6 -12', M, 3) + yaprak(54, 14, -20) + (ek || '') + parlak('M32 46 q4 -10 12 -14'); }
  D.plum = function () { return meyve('#8E5AC8', iz('M50 26 q-10 30 0 60', '#6E3FA8', 3)); };
  D.apricot = function () { return meyve('#FFB347', '<circle cx="64" cy="52" r="9" fill="#FF8A60" opacity=".55"/>', 28); };
  D.fig = function () { return p('M50 14 q8 0 8 14 q22 20 22 40 q0 24 -30 24 q-30 0 -30 -24 q0 -20 22 -40 q0 -14 8 -14 z', '#8E5AC8') + iz('M50 10 v-4', M, 3) + iz('M40 60 q10 10 20 0', '#C49AE0', 2.4); };
  D.melon = function () { return e(50, 56, 40, 32, '#E8D85A') + iz('M14 50 q36 -14 72 0 M16 64 q34 -10 68 0 M24 38 q26 -12 52 0', '#C9B830', 2.4) + iz('M50 24 q2 -8 6 -12', M, 3); };
  D.raspberry = function () { return [[40, 40], [52, 38], [64, 42], [36, 54], [48, 54], [60, 54], [70, 56], [42, 68], [54, 68], [64, 70], [50, 80]].map(function (x) { return c(x[0], x[1], 8, '#E5304D'); }).join('') + yaprak(44, 26, -40) + yaprak(52, 28, 10); };
  D.blueberries = function () { return [[32, 50], [54, 42], [70, 60], [46, 66], [28, 74]].map(function (x) { return c(x[0], x[1], 13, '#3D5FC0') + p('M' + (x[0] - 3) + ' ' + (x[1] - 10) + ' l3 4 l3 -4', '#2A3F8A') + n(x[0] - 5, x[1] - 4, 2.2, '#fff'); }).join('') + yaprak(66, 22, -30); };
  D.coconut = function () { return c(50, 54, 36, '#8F5A3A') + p('M24 46 q26 -22 52 0 q-6 32 -26 32 q-20 0 -26 -32 z', '#fff') + n(40, 32, 3) + n(50, 28, 3) + n(60, 32, 3); };
  D.avocado = function () { return p('M50 8 q18 0 20 30 q14 18 12 36 q-2 20 -32 20 q-30 0 -32 -20 q-2 -18 12 -36 q2 -30 20 -30 z', '#3F8A3A') + p('M50 16 q12 0 14 26 q10 14 8 28 q-2 14 -22 14 q-20 0 -22 -14 q-2 -14 8 -28 q2 -26 14 -26 z', '#C8E68A') + c(50, 62, 12, '#9A6A42'); };
  D.pomegranate = function () { return c(50, 56, 34, '#D23A4A') + p('M42 22 l2 -12 l6 6 l6 -6 l2 12 z', '#B8333A') + p('M50 56 m-18 0 a18 18 0 0 1 36 0', '#FFC9D4') + [[38, 52], [46, 46], [54, 46], [62, 52], [50, 54]].map(function (x) { return c(x[0], x[1], 3, '#E5304D'); }).join(''); };
  D.lime = function () { return p('M10 54 l8 -6 q16 -22 32 -22 q16 0 32 22 l8 6 l-8 6 q-16 22 -32 22 q-16 0 -32 -22 z', '#8CC63F') + yaprak(50, 26, -40) + parlak('M28 46 q8 -12 18 -14'); };
  D.tangerine = function () { return meyve('#FF8A00', '<circle cx="40" cy="52" r="1.6" fill="#E07000"/><circle cx="60" cy="62" r="1.6" fill="#E07000"/>', 28); };
  D.quince = function () { return p('M50 16 q14 0 16 16 q20 10 20 34 q0 28 -36 28 q-36 0 -36 -28 q0 -24 20 -34 q2 -16 16 -16 z', '#F2D23A') + iz('M50 14 v-6', M, 3) + yaprak(54, 10, -20) + parlak('M30 56 q2 -12 10 -16'); };

  /* ---------------- Transport ---------------- */
  function arac(govde, ek, pen) { return p('M8 70 q2 -22 16 -26 l14 -16 h30 q14 4 22 22 q6 2 6 20 z', govde) + (pen !== false ? r(40, 32, 14, 12, 2, '#BDE8F2') + r(58, 32, 14, 12, 2, '#BDE8F2') : '') + (ek || '') + teker(28, 72, 9) + teker(72, 72, 9); }
  D.ambulance = function () { return r(8, 30, 60, 42, 4, '#fff') + p('M68 40 h14 l10 14 v18 h-24 z', '#fff') + r(72, 44, 10, 10, 2, '#BDE8F2') + r(30, 40, 16, 4, 1, '#E5484D') + r(36, 34, 4, 16, 1, '#E5484D') + iz('M8 62 h84', '#E5484D', 4) + r(28, 22, 12, 8, 3, '#4AA8FF') + teker(26, 74, 9) + teker(74, 74, 9); };
  D.fireengine = function () { return r(6, 34, 62, 38, 4, '#E5484D') + p('M68 40 h14 l10 14 v18 h-24 z', '#E5484D') + r(72, 44, 10, 10, 2, '#BDE8F2') + iz('M10 30 L60 22 M14 22 L60 14', '#C7CCD6', 4) + iz('M20 30 v-14 M34 28 v-14 M48 26 v-14', '#C7CCD6', 3) + r(16, 46, 40, 10, 3, '#FFD23F') + teker(24, 74, 9) + teker(74, 74, 9); };
  D.policecar = function () { return arac('#fff', r(42, 20, 16, 8, 3, '#4AA8FF') + r(50, 20, 8, 8, 3, '#E5484D') + iz('M8 60 h86', '#2E4A8C', 6)); };
  D.scooter = function () { return iz('M24 76 h50 L70 20 h-10', M, 4) + iz('M58 20 h16', M, 5) + r(22, 70, 54, 8, 4, '#4AA8FF') + teker(24, 82, 9) + teker(74, 82, 9); };
  D.submarine = function () { return iz('M4 90 q12 -6 24 0 t24 0 t24 0 t24 0', '#4AA8FF', 3) + e(50, 56, 40, 20, '#FFD23F') + r(40, 26, 20, 16, 4, '#FFD23F') + iz('M52 26 v-12 h8', M, 3) + c(32, 56, 6, '#BDE8F2') + c(50, 56, 6, '#BDE8F2') + c(68, 56, 6, '#BDE8F2') + p('M8 50 l-6 -8 v28 l6 -8 z', '#E8B820'); };
  D.hotairballoon = function () { return p('M50 6 q34 0 34 32 q0 22 -24 38 h-20 q-24 -16 -24 -38 q0 -32 34 -32 z', '#E5484D') + p('M50 6 q-12 30 -6 70 h12 q6 -40 -6 -70 z', '#FFD23F') + iz('M40 76 l4 10 M60 76 l-4 10', M, 2) + r(40, 84, 20, 12, 3, '#C98A4B'); };
  D.tram = function () { return iz('M50 8 l-10 14 M50 8 l10 14', M, 2.4) + r(10, 22, 80, 54, 10, '#FF8A3D') + r(18, 30, 18, 18, 3, '#BDE8F2') + r(41, 30, 18, 18, 3, '#BDE8F2') + r(64, 30, 18, 18, 3, '#BDE8F2') + iz('M10 60 h80', '#fff', 4) + teker(26, 80, 7) + teker(74, 80, 7) + iz('M2 90 h96', M, 3); };
  D.sailboat = function () { return iz('M4 90 q12 -6 24 0 t24 0 t24 0 t24 0', '#4AA8FF', 3) + iz('M50 70 V8', M, 3) + p('M52 10 q30 26 24 54 h-24 z', '#fff') + p('M48 18 q-26 22 -20 46 h20 z', '#4AA8FF') + p('M10 70 h80 l-14 16 h-52 z', '#C98A4B'); };
  D.canoe = function () { return iz('M2 80 q12 -6 24 0 t24 0 t24 0 t24 0', '#4AA8FF', 3) + p('M4 62 q46 24 92 0 q-8 14 -46 14 q-38 0 -46 -14 z', '#E5484D') + iz('M70 30 L40 74', '#C98A4B', 4) + p('M66 24 l10 2 l-4 10 z', '#C98A4B') + c(52, 46, 8, TEN); };
  D.jeep = function () { return arac('#3FB86A', r(78, 46, 10, 18, 3, '#2E9D62')); };
  D.digger = function () { return r(10, 44, 50, 26, 4, '#FFD23F') + r(36, 26, 22, 20, 3, '#FFD23F') + r(40, 30, 14, 12, 2, '#BDE8F2') + iz('M58 46 L80 22 L94 50', '#E8B820', 6) + p('M84 50 h14 l-4 12 h-10 z', '#9AA7BD') + r(8, 70, 54, 16, 8, M) + c(18, 78, 4, '#C7CCD6') + c(52, 78, 4, '#C7CCD6'); };

  /* ---------------- Shapes ---------------- */
  function sekil(icx) { return icx + goz(42, 58, 50, 3) + gul(44, 58, 6); }
  function cokgen(k, f, rot) { var q = []; for (var i = 0; i < k; i++) { var a = (rot || -90) * Math.PI / 180 + i * 2 * Math.PI / k; q.push((50 + 40 * Math.cos(a)).toFixed(1) + ',' + (52 + 40 * Math.sin(a)).toFixed(1)); } return '<polygon points="' + q.join(' ') + '" fill="' + f + '" ' + A.S + '/>'; }
  D.hexagon = function () { return sekil(cokgen(6, '#FFB020', 0)); };
  D.pentagon = function () { return sekil(cokgen(5, '#3FB86A')); };
  D.semicircle = function () { return p('M8 70 a42 42 0 0 1 84 0 z', '#FF6FA5') + goz(40, 60, 56, 3) + gul(44, 62, 6); };
  D.crescent = function () { return p('M60 8 a42 42 0 1 0 30 70 a34 34 0 1 1 -30 -70 z', '#8E7CF0') + goz(34, 46, 52, 3) + gul(34, 60, 5); };
  D.cube = function () { return p('M20 32 l20 -16 h42 l-20 16 z', '#7FB7F2') + p('M62 32 l20 -16 v44 l-20 16 z', '#2E7DD8') + r(20, 32, 42, 44, 2, '#4AA8FF') + goz(34, 48, 52, 3) + gul(36, 60, 5); };
  D.cone = function () { return p('M50 8 L82 80 h-64 z', '#FF8A3D') + e(50, 80, 32, 10, '#FFB347') + goz(42, 58, 54, 3) + gul(44, 62, 6); };
  D.cylinder = function () { return r(22, 22, 56, 60, 0, '#2EB5A8') + e(50, 82, 28, 9, '#2EB5A8') + e(50, 22, 28, 9, '#5CD4C4') + goz(42, 58, 50, 3) + gul(44, 60, 6); };
  D.arrow = function () { return p('M8 40 h50 v-20 l36 30 l-36 30 v-20 h-50 z', '#E5484D'); };

  /* ---------------- Sea ---------------- */
  D.seal = function () { return p('M10 76 q4 -30 34 -36 q8 -24 30 -20 q16 4 12 22 q-4 14 -18 14 q-6 20 6 26 h-60 q-6 0 -4 -6 z', '#9AA7BD') + goz(70, 80, 30, 2.6) + n(86, 36, 2.8) + iz('M86 40 l8 -2 M86 42 l8 2', M, 1.6) + p('M42 80 l-10 12 h18 z', '#7C8AA3') + c(84, 6, 7, '#E5484D'); };
  D.squid = function () { return [26, 38, 50, 62, 74].map(function (x, i) { return kalin('M' + x + ' 60 q' + (i % 2 ? 6 : -6) + ' 16 0 30', '#F2A7C4', 6); }).join('') + p('M50 6 l24 22 v30 h-48 v-30 z', '#F2A7C4') + goz(42, 58, 44, 3.4); };
  D.lobster = function () { return iz('M40 22 q-12 -14 -24 -16 M60 22 q12 -14 24 -16', M, 2) + p('M18 34 q-12 -14 2 -24 q8 10 2 24 z M82 34 q12 -14 -2 -24 q-8 10 -2 24 z', '#E5484D') + e(50, 46, 16, 20, '#E5484D') + [64, 74, 84].map(function (y, i) { return e(50, y, 12 - i * 2, 6, '#E5484D'); }).join('') + p('M40 92 l10 -6 l10 6 z', '#E5484D') + goz(44, 56, 36, 2.6); };
  D.coral = function () { return kalin('M50 92 V50 M50 66 L30 40 M30 40 V24 M30 40 L18 32 M50 56 L70 34 M70 34 V18 M70 34 L84 28', '#FF7A80', 8) + iz('M8 94 h84', '#E8D6A8', 6); };
  D.seaweed = function () { return [[30, '#3FB86A'], [50, '#2E9D62'], [70, '#5CC97B']].map(function (x) { return p('M' + x[0] + ' 94 q-12 -20 0 -40 q12 -20 0 -44 q16 20 6 44 q-10 22 4 40 z', x[1]); }).join(''); };
  D.stingray = function () { return p('M50 20 q30 18 44 36 q-24 10 -44 6 q-20 4 -44 -6 q14 -18 44 -36 z', '#7C8AA3') + iz('M50 62 q6 16 -4 34', M, 3) + goz(42, 58, 42, 2.6); };
  D.swordfish = function () { return p('M24 50 q20 -22 52 -10 l18 -12 v40 l-18 -12 q-32 12 -52 -6 z', '#4A7FD8') + p('M44 34 l10 -20 l10 22', '#4A7FD8') + iz('M24 50 L2 46', M, 3) + n(34, 46, 3); };
  D.clownfish = function () { return p('M14 50 q20 -26 52 -10 l20 -14 v48 l-20 -14 q-32 16 -52 -10 z', '#FF8A3D') + iz('M34 34 q-6 16 0 32 M54 34 q-6 16 0 32', '#fff', 6) + n(24, 46, 3); };
  D.pufferfish = function () { return c(46, 52, 30, '#FFD23F') + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (i) { var a = i * Math.PI / 5; return iz('M' + (46 + 30 * Math.cos(a)).toFixed(1) + ' ' + (52 + 30 * Math.sin(a)).toFixed(1) + ' l' + (8 * Math.cos(a)).toFixed(1) + ' ' + (8 * Math.sin(a)).toFixed(1), M, 2.4); }).join('') + p('M76 52 l16 -10 v20 z', '#FFD23F') + goz(36, 54, 46, 3) + e(30, 62, 4, 3, '#7A2F3A'); };
  D.eel = function () { return kalin('M6 70 q16 -30 32 0 t32 0 q12 -22 22 -32', '#5CC97B', 12) + n(90, 36, 2.6); };
  D.walrus = function () { return e(50, 62, 38, 30, '#B07A40') + e(42, 64, 10, 8, '#E8B98A') + e(58, 64, 10, 8, '#E8B98A') + p('M40 70 v20 l4 -2 v-18 M60 70 v20 l-4 -2 v-18', '#fff') + goz(38, 62, 46, 3); };
  D.anchor = function () { return c(50, 16, 8, 'none') + iz('M50 24 V86 M34 36 h32', M, 6) + p('M14 62 q4 30 36 30 q32 0 36 -30 l-8 6 q-6 18 -28 18 q-22 0 -28 -18 z', '#9AA7BD'); };

  /* ---------------- Jobs ---------------- */
  function meslek(o, ek) { return kisi(o) + (ek || ''); }
  D.dentist = function () { return meslek({ stil: 'kisa', sac: '#3B2A22', ust: '#7FD3E6' }, r(30, 52, 40, 10, 5, '#BDE8F2') + p('M60 74 q4 -6 8 0 q4 -6 8 0 q0 12 -4 16 q-2 -6 -4 -6 q-2 0 -4 6 q-4 -4 -4 -16 z', '#fff')); };
  D.artist = function () { return meslek({ stil: 'uzun', sac: '#C9773A', ust: '#8E7CF0' }, e(50, 24, 22, 6, '#E5484D') + g('translate(56 62) scale(.36)', ic('paints'))); };
  D.singer = function () { return meslek({ stil: 'kuyruk', sac: '#3B2A22', ust: '#FF6FA5' }, c(66, 70, 6, M) + iz('M66 76 v14', M, 3) + g('translate(74 6) scale(.24)', hazir('nota'))); };
  D.postman = function () { return meslek({ stil: 'kisa', sac: '#8F5A3A', ust: '#E5484D' }, p('M28 28 q22 -18 44 0 v6 h-44 z', '#2E4A8C') + r(58, 70, 28, 18, 2, '#fff') + iz('M58 70 l14 10 l14 -10', M, 2)); };
  D.mechanic = function () { return meslek({ stil: 'kisa', sac: '#3B2A22', ust: '#2E7DD8' }, g('translate(58 62) rotate(-30) scale(.4)', iz('M10 50 L70 50', '#9AA7BD', 14) + c(80, 50, 14, '#9AA7BD') + c(80, 50, 6, '#fff'))); };
  D.scientist = function () { return meslek({ stil: 'kivircik', sac: '#C7CCD6', ust: '#fff', gozluk: 1 }, p('M64 64 h10 v8 l8 16 h-26 l8 -16 z', '#9ED35A') + c(66, 60, 3, '#BDE8F2')); };
  D.astronaut = function () { return c(50, 46, 30, '#fff') + c(50, 46, 20, '#2E3F6E') + n(44, 44, 2.6, '#fff') + n(56, 44, 2.6, '#fff') + iz('M44 52 q6 4 12 0', '#fff', 2) + p('M18 98 q0 -24 32 -24 q32 0 32 24 z', '#fff') + r(42, 80, 16, 10, 2, '#E5484D') + yildiz(86, 14, 6, '#FFD23F'); };
  D.waiter = function () { return meslek({ stil: 'kisa', sac: '#3B2A22', ust: '#23304D' }, p('M44 70 l6 6 l6 -6 z', '#E5484D') + e(78, 64, 16, 4, '#C7CCD6') + p('M68 62 q10 -14 20 0 z', '#C7CCD6')); };
  D.baker = function () { return meslek({ stil: 'kisa', sac: '#C9773A', ust: '#fff' }, p('M30 28 q-12 -2 -10 -12 q2 -10 14 -6 q4 -12 16 -12 q12 0 16 12 q12 -4 14 6 q2 10 -10 12 z', '#fff') + g('translate(56 66) scale(.34)', ic('bread'))); };
  D.hairdresser = function () { return meslek({ stil: 'uzun', sac: '#8E5AC8', ust: '#2EB5A8' }, g('translate(58 62) scale(.36)', ic('scissors'))); };
  D.driver = function () { return meslek({ stil: 'kisa', sac: '#3B2A22', ust: '#4AA8FF' }, p('M26 30 q24 -18 48 0 v6 h-48 z', '#5B6478') + c(70, 78, 14, 'none') + iz('M70 64 v28 M56 78 h28', M, 2.4)); };
  D.gardener = function () { return meslek({ stil: 'kisa', sac: '#8F5A3A', ust: '#3FB86A' }, e(50, 28, 32, 7, '#F2D27A') + p('M34 28 q0 -16 16 -16 q16 0 16 16 z', '#F2D27A') + g('translate(58 62) scale(.32)', hazir('cicek'))); };

  /* ---------------- Actions: tek figür ---------------- */
  function figur(o) {
    var h = '';
    (o.bacak || []).forEach(function (d) { h += kalin(d, '#2E7DD8', 8); });
    h += kalin(o.govde, '#4AA8FF', 14);
    (o.kol || []).forEach(function (d) { h += kalin(d, TEN, 7); });
    h += c(o.bas[0], o.bas[1], 12, TEN) + p('M' + (o.bas[0] - 12) + ' ' + (o.bas[1] - 2) + ' q0 -12 12 -12 q12 0 12 12 q-6 -6 -12 -5 q-6 -1 -12 5 z', '#8F5A3A');
    h += (o.goz || (n(o.bas[0] - 4, o.bas[1] + 1, 1.8) + n(o.bas[0] + 4, o.bas[1] + 1, 1.8))) + (o.agiz || iz('M' + (o.bas[0] - 3) + ' ' + (o.bas[1] + 6) + ' q3 3 6 0', M, 2));
    return (o.arka || '') + h + (o.on || '');
  }
  D.walk = function () { return figur({ bas: [50, 18], govde: 'M50 32 V58', kol: ['M50 38 L60 52', 'M50 38 L40 52'], bacak: ['M50 58 L60 88', 'M50 58 L40 88'] }) + iz('M10 92 h80', '#C7CCD6', 3); };
  D.sit = function () { return r(30, 56, 40, 8, 3, '#C98A4B') + r(30, 20, 8, 36, 3, '#C98A4B') + iz('M34 64 v26 M66 64 v26', '#B07A40', 4) + figur({ bas: [50, 22], govde: 'M50 36 V56', kol: ['M50 42 L62 52'], bacak: ['M50 56 H66 V82'] }); };
  D.stand = function () { return figur({ bas: [50, 16], govde: 'M50 30 V60', kol: ['M50 36 L40 58', 'M50 36 L60 58'], bacak: ['M50 60 L44 92', 'M50 60 L56 92'] }); };
  D.clap = function () { return figur({ bas: [50, 20], govde: 'M50 34 V62', kol: ['M50 40 L44 30 L50 24', 'M50 40 L56 30 L50 24'], bacak: ['M50 62 L42 92', 'M50 62 L58 92'], agiz: e(50, 27, 3, 3, '#7A2F3A') }) + iz('M38 14 l-6 -6 M62 14 l6 -6 M50 8 v-6', '#FFD23F', 3); };
  D.kick = function () { return figur({ bas: [40, 18], govde: 'M40 32 L44 58', kol: ['M40 38 L28 48', 'M40 38 L54 44'], bacak: ['M44 58 L40 90', 'M44 58 L66 66'] }) + c(80, 62, 10, '#fff') + iz('M72 58 q8 6 16 0', M, 2); };
  D.throw = function () { return figur({ bas: [44, 22], govde: 'M44 36 L46 62', kol: ['M44 42 L56 30 L66 22', 'M44 42 L32 52'], bacak: ['M46 62 L36 92', 'M46 62 L58 90'] }) + c(84, 12, 7, '#E5484D') + iz('M70 22 q6 -8 10 -8', '#9AA7BD', 2); };
  D.catch = function () { return figur({ bas: [50, 30], govde: 'M50 44 V66', kol: ['M50 48 L36 30', 'M50 48 L64 30'], bacak: ['M50 66 L42 94', 'M50 66 L58 94'] }) + c(50, 10, 8, '#4AA8FF'); };
  D.fly = function () { return bulut(4, 60, 0.7, '#fff') + figur({ bas: [70, 30], govde: 'M60 38 L30 48', kol: ['M56 40 L70 20', 'M48 42 L34 26'], bacak: ['M30 48 L12 44', 'M30 48 L14 56'] }) + p('M44 40 q-10 30 -30 24 l6 -10 z', '#E5484D'); };
  D.cry = function () { return c(50, 46, 30, TEN) + p('M20 40 q0 -26 30 -26 q30 0 30 26 q-10 -12 -30 -10 q-20 -2 -30 10 z', '#8F5A3A') + iz('M36 46 q4 4 8 0 M56 46 q4 4 8 0', M, 3) + iz('M40 64 q10 -8 20 0', M, 3) + damla(34, 52) + damla(66, 52) + damla(30, 70) + damla(70, 72); };
  D.laugh = function () { return c(50, 50, 32, TEN) + p('M18 44 q0 -28 32 -28 q32 0 32 28 q-10 -12 -32 -10 q-22 -2 -32 10 z', '#8F5A3A') + iz('M34 46 q5 -6 10 0 M56 46 q5 -6 10 0', M, 3) + p('M34 58 q16 22 32 0 z', '#7A2F3A') + yazi(86, 26, 'Ha!', 13, '#FF8A3D'); };
  D.write = function () { return r(14, 46, 66, 46, 3, '#fff') + iz('M22 60 h40 M22 70 h50 M22 80 h30', '#9AA7BD', 2.4) + g('rotate(40 70 40)', r(62, 10, 10, 44, 3, '#FFD23F') + p('M62 54 L67 66 L72 54 Z', '#FFE2BF')) + c(78, 34, 9, TEN); };
  D.cook = function () { return g('translate(10 30) scale(.8)', ic('tencere')) + iz('M70 18 L54 50', '#C98A4B', 5) + e(74, 12, 7, 5, '#C98A4B') + iz('M30 20 q-4 -8 0 -16 M44 22 q-4 -8 0 -16', '#9AA7BD', 3); };
  D.wash = function () { return p('M14 50 h72 v6 q0 30 -36 30 q-36 0 -36 -30 z', '#4AA8FF') + c(34, 46, 8, '#E3F4FF') + c(50, 40, 10, '#E3F4FF') + c(66, 46, 7, '#E3F4FF') + kalin('M30 72 L44 56 M70 72 L56 56', TEN, 8) + c(80, 18, 6, '#E3F4FF') + c(18, 22, 4, '#E3F4FF'); };
  D.ride = function () { return '<circle cx="24" cy="74" r="15" fill="none" stroke="' + M + '" stroke-width="4"/><circle cx="76" cy="74" r="15" fill="none" stroke="' + M + '" stroke-width="4"/>' + iz('M24 74 L40 52 H64 L76 74 M40 52 L52 74 L64 52', '#E5484D', 4) + figur({ bas: [52, 16], govde: 'M50 30 L42 48', kol: ['M48 34 L66 44'], bacak: ['M42 48 L52 62 L50 74'] }); };

  /* ---------------- Seasons (mevsim eşyaları) ---------------- */
  D.flower = function () { return hazir('cicek'); };
  D.leaf = function () { return ic('yaprak'); };
  D.beach = function () { return gunes(80, 18, 9) + iz('M2 64 q12 -6 24 0 t24 0 t24 0 t24 0', '#4AA8FF', 4) + p('M0 70 h100 v30 h-100 z', '#FFE08A') + iz('M32 92 V40', M, 3) + p('M8 44 q24 -26 48 0 z', '#FF6FA5') + g('translate(58 70) scale(.22)', ic('bucket')); };
  D.snowflake = function () { return kar(50, 50, 38) + [0, 1, 2, 3, 4, 5].map(function (i) { var a = i * Math.PI / 3 - Math.PI / 2, x = 50 + 26 * Math.cos(a), y = 50 + 26 * Math.sin(a); return iz('M' + x.toFixed(1) + ' ' + y.toFixed(1) + ' l' + (8 * Math.cos(a + 0.8)).toFixed(1) + ' ' + (8 * Math.sin(a + 0.8)).toFixed(1) + ' M' + x.toFixed(1) + ' ' + y.toFixed(1) + ' l' + (8 * Math.cos(a - 0.8)).toFixed(1) + ' ' + (8 * Math.sin(a - 0.8)).toFixed(1), '#4AA8FF', 3); }).join(''); };
  D.sledge = function () { return p('M8 66 h76 q12 0 12 -12', '').replace('fill="none"', 'fill="none"') + iz('M8 66 h76 q12 0 12 -12', M, 4) + r(16, 44, 64, 12, 3, '#E5484D') + iz('M24 56 v10 M70 56 v10', M, 4) + kar(20, 22, 5) + kar(80, 18, 4); };
  D.pumpkin = function () { return e(50, 58, 40, 32, '#FF8A3D') + iz('M50 28 q-14 30 0 60 M50 28 q14 30 0 60 M30 34 q-12 24 0 48 M70 34 q12 24 0 48', '#E06A1A', 2.6) + r(46, 14, 8, 16, 3, '#4CC38A'); };
  D.picnic = function () { return p('M4 64 h92 l-8 30 h-76 z', '#E5484D') + iz('M14 64 l-6 30 M34 64 l-2 30 M54 64 v30 M74 64 l2 30 M8 78 h84', '#fff', 3) + g('translate(20 20) scale(.44)', ic('apple')) + g('translate(50 20) scale(.44)', ic('sandwich')); };
  D.nest = function () { return e(50, 66, 40, 18, '#B07A40') + iz('M14 62 q36 10 72 0 M18 72 q32 8 64 0', '#8F5A3A', 2.4) + e(38, 54, 8, 10, '#BDE8F2') + e(52, 52, 8, 10, '#BDE8F2') + e(64, 56, 8, 10, '#BDE8F2'); };

  /* ---------------- Days ---------------- */
  function takvim(renk, ust, alt) { return r(14, 10, 72, 80, 10, '#fff') + p('M14 30 v-10 q0 -10 10 -10 h52 q10 0 10 10 v10 z', renk) + iz('M32 6 v10 M68 6 v10', M, 4) + ust + (alt || ''); }
  D.today = function () { return takvim('#E5484D', yazi(50, 62, 'TODAY', 16, '#E5484D') + c(50, 76, 6, '#FFD23F')); };
  D.tomorrow = function () { return takvim('#4AA8FF', yazi(50, 62, '+1', 26, '#4AA8FF') + iz('M30 78 h34 l-6 -5 M64 78 l-6 5', M, 2.6)); };
  D.yesterday = function () { return takvim('#9AA7BD', yazi(50, 62, '-1', 26, '#7C8AA3') + iz('M70 78 h-34 l6 -5 M36 78 l6 5', M, 2.6)); };
  D.weekend = function () { return takvim('#FF6FA5', yazi(50, 58, 'SAT', 14, '#FF6FA5') + yazi(50, 76, 'SUN', 14, '#E5484D')); };
  D.week = function () { return takvim('#3FB86A', [0, 1, 2, 3, 4, 5, 6].map(function (i) { return r(20 + i * 8.6, 46, 7, 22, 2, ['#2E8FE8', '#3FB86A', '#E8A400', '#FF7A1A', '#8E7CF0', '#FF6FA5', '#E5484D'][i]); }).join('') + yazi(50, 84, '7', 12, M)); };

  /* ---------------- Places ---------------- */
  var kutu = function (x) { return r(x, 50, 34, 38, 4, '#C98A4B') + iz('M' + x + ' 62 h34', '#B07A40', 3); }, top_ = function (x, y) { return c(x, y, 10, '#E5484D') + iz('M' + (x - 8) + ' ' + (y - 3) + ' q8 6 16 0', '#fff', 2.4); };
  D.between = function () { return kutu(6) + kutu(60) + top_(50, 78); };
  D.above = function () { return kutu(33) + top_(50, 16) + iz('M42 30 l-4 4 M58 30 l4 4', '#9AA7BD', 2.4); };
  D.near = function () { return kutu(30) + top_(74, 78) + iz('M66 92 h16', '#9AA7BD', 2); };
  D.far = function () { return g('translate(6 30) scale(.7)', kutu(0)) + c(90, 84, 5, '#E5484D') + iz('M34 94 h46', '#9AA7BD', 2).replace('stroke-linecap="round"', 'stroke-dasharray="4 4" stroke-linecap="round"'); };

  Object.keys(D).forEach(function (k) { if (D[k]) RS.ekle(k, D[k]); });
})(window);
