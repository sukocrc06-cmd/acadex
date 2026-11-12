/* ==========================================================================
   ACADEX KIDS · ikinci kat ve yeni tema çizimleri (kids/assets/kids-resim2.js), 12.11.2026
   kids-resim.js'in diliyle (aynı yardımcılar, KIDS_RESIM.A): eski on temanın
   ikinci kat kelimeleri (her temaya +10) ve on yeni temanın (Fruits, Transport,
   Shapes, Sea, Jobs, Actions, Seasons, Days, Places, Alphabet) çizimleri.
   Hareketler tek bir çocuk figüründen, meslekler insan çiziminden, harfler ve günler
   kart çiziminden çıkar. KIDS_RESIM.ekle ile kaydolur.
   ========================================================================== */
(function (W) {
  'use strict';
  var RS = W.KIDS_RESIM, C = W.KIDS_CIZ, A = RS.A, M = A.M, S = A.S, TEN = A.TEN;
  var p = A.p, c = A.c, e = A.e, r = A.r, n = A.n, iz = A.iz, kalin = A.kalin, g = A.g, yazi = A.yazi, parlak = A.parlak, yildiz = A.yildiz, yildizYol = A.yildizYol;
  var gunes = A.gunes, bulut = A.bulut, damla = A.damla, kar = A.kar, kisi = A.kisi, icAl = A.icAl, hazir = A.hazir, AILE = A.AILE;
  function goz2(x1, x2, y, k) { k = k || 3.6; return n(x1, y, k) + n(x2, y, k) + n(x1 + 1.3, y - 1.4, k * 0.38, '#fff') + n(x2 + 1.3, y - 1.4, k * 0.38, '#fff'); }
  function gul(x, y, w) { return iz('M' + (x - w) + ' ' + y + ' q' + w + ' ' + (w * 0.8) + ' ' + (w * 2) + ' 0', M, 3); }
  function yanak(x1, x2, y) { return '<circle cx="' + x1 + '" cy="' + y + '" r="4" fill="#FF9EB5" opacity=".7"/><circle cx="' + x2 + '" cy="' + y + '" r="4" fill="#FF9EB5" opacity=".7"/>'; }
  function kalp(x, y, k, f) { return g('translate(' + x + ' ' + y + ') scale(' + k + ')', p('M0 6 q-10 -12 -18 -4 q-8 10 18 26 q26 -16 18 -26 q-8 -8 -18 4 z', f || '#E5484D')); }
  function ai(ad) { return RS.ic(ad); }
  function kucukAgac(x, y, tepe, s) { return g('translate(' + x + ' ' + y + ') scale(' + (s || 1) + ')', r(-4, 0, 8, 26, 2, '#B07A40') + c(0, -8, 18, tepe)); }
  var D = {};

  /* ---------------- Animals · ikinci kat ---------------- */
  D.horse = function () { return p('M33 24 l4 -18 l9 15 z', '#B07A40') + p('M67 24 l-4 -18 l-9 15 z', '#B07A40') + e(50, 46, 22, 27, '#C98A4B') + p('M38 20 q12 -12 24 0 q-4 12 -12 12 q-8 0 -12 -12 z', '#5B3A22') + e(50, 72, 18, 14, '#E8B98A') + n(44, 72, 2.6) + n(56, 72, 2.6) + goz2(40, 60, 44); };
  D.pig = function () { return p('M24 32 l-4 -20 l20 9 z', '#FFB3C7') + p('M76 32 l4 -20 l-20 9 z', '#FFB3C7') + c(50, 54, 33, '#FFB3C7') + e(50, 64, 14, 10, '#FF8FAE') + n(45, 64, 2.8) + n(55, 64, 2.8) + goz2(37, 63, 46) + yanak(28, 72, 58); };
  D.sheep = function () { return [[30, 30, 12], [50, 24, 13], [70, 30, 12], [24, 50, 11], [76, 50, 11], [32, 74, 11], [68, 74, 11], [50, 80, 11]].map(function (x) { return c(x[0], x[1], x[2], '#fff'); }).join('') + e(28, 50, 9, 5, '#5B4636') + e(72, 50, 9, 5, '#5B4636') + e(50, 54, 18, 22, '#5B4636') + n(43, 50, 3.4, '#fff') + n(57, 50, 3.4, '#fff') + n(43, 50, 1.6) + n(57, 50, 1.6) + iz('M45 66 q5 4 10 0', '#fff', 2.6); };
  D.duck = function () { return iz('M4 90 q10 -6 20 0 t20 0 t20 0 t20 0 t20 0', '#4AA8FF', 3) + p('M12 60 q4 -18 30 -16 q16 2 22 -8 q16 4 16 24 q0 20 -32 22 q-30 2 -36 -22 z', '#FFD84D') + c(66, 32, 16, '#FFD84D') + p('M80 32 l15 4 l-15 7 z', '#FF8A3D') + n(70, 28, 3.2) + p('M28 60 q14 -10 28 4 q-14 10 -28 -4 z', '#F2C230'); };
  D.monkey = function () { return c(20, 50, 11, '#9A6A42') + c(80, 50, 11, '#9A6A42') + c(20, 50, 5, '#FFD0A8') + c(80, 50, 5, '#FFD0A8') + c(50, 48, 30, '#9A6A42') + p('M28 54 q0 -18 11 -18 q11 0 11 7 q0 -7 11 -7 q11 0 11 18 q0 24 -22 24 q-22 0 -22 -24 z', '#FFD0A8') + goz2(41, 59, 48, 3.2) + n(47, 60, 1.7) + n(53, 60, 1.7) + gul(43, 66, 7); };
  D.elephant = function () { return e(20, 44, 18, 24, '#AEB8CC') + e(80, 44, 18, 24, '#AEB8CC') + e(20, 44, 10, 15, '#FFC9D4') + e(80, 44, 10, 15, '#FFC9D4') + c(50, 42, 26, '#AEB8CC') + p('M43 56 q0 22 -3 30 q0 7 7 7 q7 0 7 -7 q0 -12 3 -30 z', '#AEB8CC') + iz('M44 70 h8 M44 78 h8', M, 2) + goz2(40, 60, 38, 3.4) + yanak(34, 66, 50); };
  D.giraffe = function () { return r(42, 46, 16, 52, 6, '#FFC94D') + c(46, 60, 3.4, '#C98A4B') + c(54, 74, 3.4, '#C98A4B') + c(47, 88, 3, '#C98A4B') + iz('M44 18 v-10 M56 18 v-10', M, 3) + c(44, 8, 3.4, '#C98A4B') + c(56, 8, 3.4, '#C98A4B') + e(30, 26, 8, 4.4, '#FFC94D') + e(70, 26, 8, 4.4, '#FFC94D') + e(50, 32, 17, 15, '#FFC94D') + e(50, 41, 11, 7, '#F2B13A') + goz2(44, 56, 29, 2.8) + n(46, 41, 1.4) + n(54, 41, 1.4); };
  D.tiger = function () { return p('M20 44 L24 14 L44 30 Z M80 44 L76 14 L56 30 Z', '#FF9F45') + c(50, 54, 33, '#FF9F45') + iz('M50 22 v12 M28 40 l10 4 M72 40 l-10 4 M22 58 h11 M78 58 h-11 M24 68 h9 M76 68 h-9', M, 3) + e(50, 66, 15, 11, '#fff') + p('M46 59 h8 l-4 5 z', M) + iz('M50 64 q-5 6 -10 2 M50 64 q5 6 10 2', M, 2.4) + goz2(39, 61, 48, 4); };
  D.mouse = function () { return c(26, 30, 16, '#C7CCD6') + c(74, 30, 16, '#C7CCD6') + c(26, 30, 9, '#FFC9D4') + c(74, 30, 9, '#FFC9D4') + e(50, 58, 27, 25, '#C7CCD6') + iz('M28 70 h-16 M28 77 h-15 M72 70 h16 M72 77 h15', M, 2) + n(50, 72, 4.4, '#FF8FAE') + goz2(40, 60, 54); };
  D.snake = function () { return kalin('M12 82 q15 -22 30 0 t30 0 q12 -18 6 -38 q-4 -14 10 -20', '#4CC38A', 12) + e(88, 22, 11, 8, '#4CC38A') + n(85, 19, 2.2) + n(92, 19, 2.2) + iz('M98 24 l6 1 m-6 -1 l6 -3', '#E5484D', 2) + '<circle cx="28" cy="74" r="2.4" fill="#2E9D62"/><circle cx="58" cy="86" r="2.4" fill="#2E9D62"/><circle cx="76" cy="58" r="2.4" fill="#2E9D62"/>'; };

  /* ---------------- Family · ikinci kat ---------------- */
  D.boy = function () { return kisi({ stil: 'kisa', sac: '#3B2A22', ust: '#4AA8FF', olcek: 0.88 }); };
  D.girl = function () { return kisi({ stil: 'kuyruk', sac: '#8F5A3A', ust: '#FF6FA5', olcek: 0.88, toka: '#FFD23F' }); };
  D.man = function () { return kisi({ stil: 'kisa', sac: '#C9773A', ust: '#5B6478', gozluk: 1 }); };
  D.woman = function () { return kisi({ stil: 'uzun', sac: '#3B2A22', ust: '#4CC38A' }); };
  D.cousin = function () { return kisi({ stil: 'kivircik', sac: '#3B2A22', ust: '#FFD23F', olcek: 0.88 }); };
  D.friend = function () { return g('translate(-14 12) scale(.72)', kisi({ stil: 'diken', sac: '#3B2A22', ust: '#4CC38A' })) + g('translate(42 12) scale(.72)', kisi({ stil: 'kuyruk', sac: '#C9773A', ust: '#8E7CF0' })) + kalp(50, 14, 0.5); };
  D.parents = function () { return g('translate(-12 8) scale(.74)', kisi(AILE.dad)) + g('translate(38 8) scale(.74)', kisi(AILE.mum)); };
  D.grandparents = function () { return g('translate(-12 8) scale(.74)', kisi(AILE.grandpa)) + g('translate(38 8) scale(.74)', kisi(AILE.grandma)); };
  D.twins = function () { var t = { stil: 'kuyruk', sac: '#8F5A3A', ust: '#FF9F45' }; return g('translate(-10 14) scale(.7)', kisi(t)) + g('translate(40 14) scale(.7)', kisi(t)); };
  D.pet = function () { return g('translate(8 14) scale(.84)', icAl(C.avatar('kopek'))) + kalp(78, 10, 0.5); };

  /* ---------------- My Body · ikinci kat ---------------- */
  function yuzTam(ek) { return c(50, 52, 36, TEN) + p('M16 46 q0 -34 34 -34 q34 0 34 34 q-10 -16 -24 -14 q-12 8 -44 14 z', '#8F5A3A') + goz2(38, 62, 50, 3.6) + iz('M48 58 q2 4 4 0', M, 2.6) + gul(42, 68, 8) + (ek || ''); }
  D.face = function () { return yuzTam(yanak(30, 70, 62)); };
  D.cheeks = function () { return yuzTam('<circle cx="28" cy="62" r="9" fill="#FF6FA5" opacity=".8"/><circle cx="72" cy="62" r="9" fill="#FF6FA5" opacity=".8"/>' + iz('M22 60 l4 -3 M30 60 l4 -3 M66 60 l4 -3 M74 60 l4 -3', '#fff', 2)); };
  D.fingers = function () { return r(22, 16, 10, 40, 5, TEN) + r(34, 8, 10, 46, 5, TEN) + r(46, 6, 10, 48, 5, TEN) + r(58, 10, 10, 44, 5, TEN) + r(70, 24, 9, 34, 4.5, TEN) + r(22, 44, 57, 46, 18, TEN) + [27, 39, 51, 63, 74.5].map(function (x, i) { return '<circle cx="' + x + '" cy="' + [22, 14, 12, 16, 30][i] + '" r="3.4" fill="' + ['#E5484D', '#FF8A3D', '#FFD23F', '#4CC38A', '#4AA8FF'][i] + '"/>'; }).join(''); };
  D.toes = function () { return p('M28 92 q-10 0 -10 -26 q0 -30 12 -40 h40 q12 10 12 40 q0 26 -10 26 z', TEN) + c(28, 22, 7, TEN) + c(42, 16, 7, TEN) + c(56, 16, 6.4, TEN) + c(68, 20, 5.8, TEN) + c(78, 27, 5, TEN) + '<circle cx="42" cy="14" r="2.6" fill="#FF6FA5"/><circle cx="56" cy="14" r="2.4" fill="#FF6FA5"/>'; };
  D.teeth = function () { return p('M10 48 q40 -36 80 0 q-6 34 -40 34 q-34 0 -40 -34 z', '#FF6F7D') + p('M18 48 q32 -22 64 0 v6 h-64 z', '#fff') + p('M22 68 q28 10 56 0 v-4 h-56 z', '#fff') + iz('M34 44 v10 M50 40 v14 M66 44 v10 M36 64 v6 M50 66 v6 M64 64 v6', M, 2); };
  D.tongue = function () { return p('M14 44 q36 -26 72 0 q-6 26 -36 26 q-30 0 -36 -26 z', '#7A2F3A') + p('M34 52 q16 -6 32 0 v22 q0 16 -16 16 q-16 0 -16 -16 z', '#FF7A8A') + iz('M50 58 v18', '#E25A6E', 3); };
  D.neck = function () { return p('M14 98 q0 -26 36 -26 q36 0 36 26 z', '#4CC38A') + r(40, 52, 20, 28, 4, TEN) + c(50, 36, 22, TEN) + p('M28 32 q0 -20 22 -20 q22 0 22 20 q-8 -10 -22 -8 q-14 -2 -22 8 z', '#8F5A3A') + goz2(43, 57, 36, 2.6) + iz('M34 64 q16 8 32 0', '#FFD23F', 5); };
  D.shoulders = function () { return p('M8 96 q0 -34 42 -34 q42 0 42 34 z', '#4AA8FF') + r(42, 46, 16, 20, 3, TEN) + c(50, 32, 20, TEN) + p('M30 28 q0 -18 20 -18 q20 0 20 18 q-8 -8 -20 -6 q-12 -2 -20 6 z', '#3B2A22') + goz2(43, 57, 32, 2.6) + yildiz(18, 68, 9, '#FFD23F') + yildiz(82, 68, 9, '#FFD23F'); };
  D.knees = function () { return kalin('M24 10 L50 52 L32 92', TEN, 18) + r(14, 4, 24, 22, 6, '#4AA8FF') + c(50, 52, 10, '#FFC2A1') + yildiz(68, 40, 8, '#FFD23F') + e(38, 94, 14, 6, '#E5484D'); };
  D.tummy = function () { return r(18, 8, 64, 20, 8, '#4CC38A') + e(50, 52, 32, 30, TEN) + n(50, 56, 2.6, '#E2A48A') + r(20, 74, 60, 20, 6, '#4AA8FF') + iz('M36 40 q14 -6 28 0', '#F2B39A', 3); };

  /* ---------------- Food · ikinci kat ---------------- */
  D.pizza = function () { return p('M12 22 L88 22 L50 94 Z', '#FFC94D') + p('M10 18 q40 -12 80 0 v10 q-40 -10 -80 0 z', '#D9934A') + c(36, 36, 6, '#E5484D') + c(62, 38, 6, '#E5484D') + c(50, 58, 5, '#E5484D') + p('M44 44 q6 -6 10 0 q-4 6 -10 0 z', '#4CC38A'); };
  D.sandwich = function () { return p('M8 70 L50 18 L92 70 Z', '#FFE6B8') + iz('M18 60 h64', '#4CC38A', 7) + iz('M24 52 h52', '#E5484D', 5) + iz('M30 44 h40', '#FFD23F', 5) + r(8, 70, 84, 12, 4, '#D9934A'); };
  D.soup = function () { return iz('M36 30 q-6 -8 0 -16 M50 30 q-6 -8 0 -16 M64 30 q-6 -8 0 -16', '#9AA7BD', 3) + p('M10 44 h80 q0 40 -40 40 q-40 0 -40 -40 z', '#E5484D') + e(50, 44, 40, 9, '#FFB347') + c(38, 44, 3, '#4CC38A') + c(58, 46, 3, '#FF8A3D') + iz('M74 42 l16 -26', M, 4) + e(90, 14, 5, 4, '#C7CCD6') + iz('M30 90 h40', M, 3); };
  D.rice = function () { return iz('M60 8 l24 50 M70 6 l20 50', '#C98A4B', 4) + p('M16 54 q34 -34 68 0 z', '#fff') + '<circle cx="34" cy="44" r="2" fill="#E3E8F2"/><circle cx="50" cy="36" r="2" fill="#E3E8F2"/><circle cx="64" cy="44" r="2" fill="#E3E8F2"/>' + p('M10 54 h80 q0 34 -40 34 q-40 0 -40 -34 z', '#4AA8FF') + iz('M22 66 q28 8 56 0', '#fff', 3); };
  D.cookie = function () { return c(50, 50, 38, '#D9934A') + [[36, 34], [60, 30], [66, 54], [44, 60], [30, 50], [54, 74]].map(function (x) { return '<circle cx="' + x[0] + '" cy="' + x[1] + '" r="5" fill="#5B3A22"/>'; }).join('') + parlak('M26 30 q6 -8 14 -10'); };
  D.icecream = function () { return p('M32 50 L50 96 L68 50 Z', '#E8A85A') + iz('M38 58 l20 22 M46 52 l18 18 M62 58 l-20 22 M54 52 l-18 18', '#C98A4B', 2) + c(40, 44, 14, '#FF9EB5') + c(60, 44, 14, '#FFF3DD') + c(50, 28, 15, '#9A6A42') + c(52, 10, 5, '#E5484D'); };
  D.chicken = function () { return r(58, 62, 26, 10, 5, '#fff') + c(86, 62, 6, '#fff') + c(86, 72, 6, '#fff') + p('M18 64 q-12 -22 8 -40 q22 -18 38 2 q12 18 -4 34 q-14 14 -42 4 z', '#D9934A') + parlak('M26 34 q8 -10 18 -10'); };
  D.pasta = function () { return e(50, 66, 44, 16, '#fff') + iz('M22 60 q6 -12 12 0 t12 0 t12 0 t12 0 t12 0 M26 68 q6 -10 12 0 t12 0 t12 0 t12 0', '#F2B92A', 4) + c(50, 56, 10, '#E5484D') + iz('M82 20 l-12 36 M78 18 l-2 8 M84 20 l-2 8 M88 22 l-2 8', '#9AA7BD', 3); };
  D.honey = function () { return r(22, 22, 56, 12, 4, '#C98A4B') + r(24, 34, 52, 58, 12, '#FFB020') + p('M30 34 q4 10 8 0 q4 14 8 0 q4 8 8 0', '#FFB020') + e(50, 64, 18, 12, '#FFF3DD') + yazi(50, 68, 'HONEY', 9, '#C98A4B') + parlak('M32 46 v30'); };
  D.chocolate = function () { return r(22, 10, 56, 80, 6, '#7A4A2A') + iz('M22 30 h56 M22 50 h56 M50 10 v40', '#5B3A22', 3) + p('M22 56 h56 v34 q0 0 0 0 h-56 z', '#E5484D') + p('M22 56 l10 6 l10 -6 l10 6 l10 -6 l10 6 l6 -4', '#C7CCD6') + yazi(50, 80, 'CHOCO', 10); };

  /* ---------------- Toys · ikinci kat ---------------- */
  D.puzzle = function () { return p('M10 14 h28 q-4 -10 8 -10 q12 0 8 10 h28 v28 q10 -4 10 8 q0 12 -10 8 v28 h-72 z', '#4AA8FF') + p('M30 46 h14 q-2 -6 4 -6 q6 0 4 6 h14 v14 q6 -2 6 4 q0 6 -6 4 v14 h-36 z', '#FFD23F'); };
  D.yoyo = function () { return iz('M50 46 V4', M, 2.4) + c(50, 4, 3.4, '#fff') + c(50, 56, 34, '#E5484D') + c(50, 56, 14, '#FFD23F') + n(50, 56, 3) + parlak('M26 44 q4 -12 14 -16'); };
  D.dinosaur = function () { return p('M8 74 q0 -26 26 -30 q12 -2 18 -16 q6 -16 24 -14 q14 2 14 14 q0 10 -12 10 h-6 q-2 24 -12 36 l4 16 h-10 l-4 -12 h-14 l-2 12 h-10 l2 -14 q-14 -2 -18 -2 z', '#4CC38A') + p('M40 42 l4 -8 l4 6 l4 -10 l4 8 l4 -8', '#FFD23F') + n(78, 24, 3) + iz('M80 32 h6', M, 2.4); };
  D.bubbles = function () { return iz('M14 92 l24 -30', '#FF8A3D', 5) + '<circle cx="44" cy="56" r="9" fill="none" stroke="' + M + '" stroke-width="3"/>' + [[62, 36, 14], [80, 66, 9], [36, 22, 10], [84, 18, 7]].map(function (x) { return '<circle cx="' + x[0] + '" cy="' + x[1] + '" r="' + x[2] + '" fill="#E3F4FF" stroke="#4AA8FF" stroke-width="3"/><path d="M' + (x[0] - x[2] * 0.5) + ' ' + (x[1] - x[2] * 0.2) + ' q2 -4 6 -5" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>'; }).join(''); };
  D.skateboard = function () { return r(6, 44, 88, 14, 7, '#FF8A3D') + iz('M16 50 h68', '#FFD23F', 3) + iz('M26 58 v6 M74 58 v6', M, 4) + c(26, 70, 7, '#FFD23F') + c(74, 70, 7, '#FFD23F'); };
  D.dice = function () { return p('M18 32 l14 -14 h52 l-14 14 z', '#E3E8F2') + p('M70 32 l14 -14 v52 l-14 14 z', '#C7CCD6') + r(18, 32, 52, 52, 8, '#fff') + n(30, 44, 4.6, '#E5484D') + n(44, 58, 4.6, '#E5484D') + n(58, 72, 4.6, '#E5484D') + n(51, 25, 3) + n(77, 44, 3) + n(77, 60, 3); };
  D.marbles = function () { return [[30, 64, '#E5484D'], [62, 66, '#4AA8FF'], [46, 40, '#4CC38A'], [76, 40, '#FFD23F']].map(function (x) { return c(x[0], x[1], 14, x[2]) + iz('M' + (x[0] - 7) + ' ' + (x[1] + 2) + ' q7 -10 14 0', '#fff', 2.4) + n(x[0] - 5, x[1] - 6, 2.4, '#fff'); }).join(''); };
  D.piano = function () { return r(6, 24, 88, 14, 4, '#8E5A3A') + r(6, 38, 88, 46, 4, '#fff') + iz('M18.6 38 v46 M31.2 38 v46 M43.8 38 v46 M56.4 38 v46 M69 38 v46 M81.6 38 v46', M, 2) + [15, 27, 52, 65, 77].map(function (x) { return '<rect x="' + x + '" y="38" width="7" height="26" rx="1" fill="' + M + '"/>'; }).join(''); };
  D.whistle = function () { return iz('M20 30 q-12 30 18 40', '#E5484D', 3) + p('M30 40 h40 q14 0 14 14 q0 16 -16 16 q-14 0 -18 -12 h-20 z', '#FFD23F') + c(66, 56, 6, '#fff') + r(22, 36, 10, 10, 3, '#C7CCD6'); };
  D.puppet = function () { return p('M26 92 V40 q0 -30 24 -30 q24 0 24 30 v52 z', '#8E7CF0') + p('M26 50 q24 16 48 0 q-4 18 -24 18 q-20 0 -24 -18 z', '#E5484D') + c(40, 30, 7, '#fff') + c(60, 30, 7, '#fff') + n(41, 31, 3) + n(61, 31, 3) + r(24, 84, 52, 8, 3, '#B9A8FF'); };

  /* ---------------- Clothes · ikinci kat ---------------- */
  D.skirt = function () { return r(30, 14, 40, 9, 3, '#6E5BD8') + p('M30 23 h40 l20 62 h-80 z', '#8E7CF0') + iz('M40 23 l-8 62 M50 23 v62 M60 23 l8 62', '#6E5BD8', 2.4); };
  D.shorts = function () { return p('M22 18 H78 L84 74 H56 L50 46 L44 74 H16 Z', '#FF8A3D') + iz('M22 28 H78', M, 3) + iz('M50 28 V44', M, 3); };
  D.jacket = function () { return p('M36 12 L18 22 L10 78 H26 V84 H74 V78 H90 L82 22 L64 12 Q50 22 36 12 Z', '#2E7DD8') + iz('M50 20 V84', '#FFD23F', 3) + r(24, 54, 14, 14, 3, '#2569B8') + r(62, 54, 14, 14, 3, '#2569B8') + p('M36 12 q14 -12 28 0 q-14 8 -28 0 z', '#2569B8'); };
  D.sweater = function () { return p('M34 14 L16 22 L6 80 H22 L28 44 V90 H72 V44 L78 80 H94 L84 22 L66 14 Q50 26 34 14 Z', '#E5484D') + iz('M28 56 H72 M28 66 H72', '#fff', 4) + iz('M8 74 h12 M80 74 h12 M28 84 h44', '#B8333A', 3); };
  D.pyjamas = function () { return p('M32 8 L16 16 L10 46 H22 L26 30 V52 H74 V30 L78 46 H90 L84 16 L68 8 Q50 18 32 8 Z', '#B9C7FF') + p('M28 52 H72 L76 94 H56 L50 66 L44 94 H24 Z', '#B9C7FF') + yildiz(40, 30, 5, '#FFD23F') + yildiz(60, 40, 5, '#FFD23F') + yildiz(38, 76, 4, '#FFD23F') + yildiz(64, 82, 4, '#FFD23F') + p('M44 22 a6 6 0 1 0 8 8 a8 8 0 0 1 -8 -8 z', '#FFD23F'); };
  D.cap = function () { return p('M18 58 q0 -36 32 -36 q30 0 32 32 z', '#E5484D') + p('M48 56 q32 -2 46 10 q-22 8 -46 0 z', '#B8333A') + c(50, 22, 3.4, '#B8333A') + iz('M50 22 v32', '#B8333A', 2); };
  D.sunglasses = function () { return iz('M14 42 l-6 -10 M86 42 l6 -10', M, 3) + r(12, 40, 32, 24, 10, '#23304D') + r(56, 40, 32, 24, 10, '#23304D') + iz('M44 48 q6 -6 12 0', M, 3) + iz('M18 46 l8 -2 M62 46 l8 -2', '#fff', 2.4); };
  D.belt = function () { return r(4, 42, 92, 16, 4, '#8F5A3A') + r(36, 36, 28, 28, 4, '#FFD23F') + r(42, 42, 16, 16, 2, '#8F5A3A') + iz('M50 50 h12', '#C7CCD6', 3) + n(16, 50, 2.4) + n(24, 50, 2.4); };
  D.sandals = function () { var t = e(26, 66, 14, 26, '#C98A4B') + iz('M14 52 q12 -10 24 0 M14 70 q12 -8 24 0', '#E5484D', 5); return g('translate(46 -6)', t) + t; };
  D.swimsuit = function () { return p('M32 10 v12 q-4 20 -10 32 q-4 12 4 24 l16 14 h16 l16 -14 q8 -12 4 -24 q-6 -12 -10 -32 v-12 l-6 0 q-6 14 -12 14 q-6 0 -12 -14 z', '#2EB5A8') + c(40, 50, 4, '#FFD23F') + c(60, 60, 4, '#FFD23F') + c(48, 74, 4, '#FFD23F'); };

  /* ---------------- My Home · ikinci kat ---------------- */
  D.shower = function () { return ai('dus'); };
  D.mirror = function () { return iz('M50 86 v8 M36 94 h28', M, 4) + e(50, 46, 32, 40, '#C98A4B') + e(50, 46, 25, 33, '#DDF3FF') + iz('M38 30 l-6 14 M46 26 l-12 28', '#fff', 4); };
  D.sink = function () { return iz('M50 30 V14 h16 v8', M, 4) + c(40, 22, 4, '#9AA7BD') + p('M10 40 h80 v8 q0 30 -40 30 q-40 0 -40 -30 z', '#fff') + iz('M14 48 h72', '#BDE8F2', 4) + r(42, 78, 16, 16, 2, '#C7CCD6') + damla(66, 26); };
  D.cooker = function () { return r(14, 20, 72, 74, 6, '#E3E8F2') + e(34, 26, 10, 3, '#5B6478') + e(66, 26, 10, 3, '#5B6478') + iz('M14 34 h72', M, 3) + c(28, 42, 3.4, '#E5484D') + c(42, 42, 3.4, '#E5484D') + c(58, 42, 3.4, '#E5484D') + c(72, 42, 3.4, '#E5484D') + r(22, 52, 56, 34, 4, '#5B6478') + r(30, 58, 40, 20, 3, '#FFB347'); };
  D.wardrobe = function () { return r(16, 6, 68, 84, 4, '#C98A4B') + iz('M50 6 V90', M, 3) + c(44, 48, 2.6, '#FFD23F') + c(56, 48, 2.6, '#FFD23F') + iz('M22 90 v6 M78 90 v6', M, 4) + r(24, 14, 20, 26, 3, '#E8A85A') + r(56, 14, 20, 26, 3, '#E8A85A'); };
  D.carpet = function () { return p('M18 30 h64 l14 50 h-92 z', '#E5484D') + p('M28 38 h44 l8 34 h-60 z', '#FFD23F') + yildiz(50, 55, 9, '#E5484D') + iz('M8 84 v6 M20 84 v6 M32 84 v6 M44 84 v6 M56 84 v6 M68 84 v6 M80 84 v6 M92 84 v6', M, 2.4); };
  D.stairs = function () { return p('M8 92 V76 H28 V60 H48 V44 H68 V28 H92 V92 Z', '#C98A4B') + iz('M28 76 V92 M48 60 V92 M68 44 V92', '#B07A40', 2.4) + iz('M8 76 L92 12', M, 3) + iz('M28 76 v-24 M48 60 v-24 M68 44 v-24 M88 28 v-24', M, 2); };
  D.plant = function () { return p('M50 60 q-30 -6 -30 -36 q22 0 30 30 z', '#4CC38A') + p('M50 60 q30 -6 30 -36 q-22 0 -30 30 z', '#3FB86A') + p('M50 60 q-4 -30 0 -50 q8 24 0 50 z', '#6FD69A') + p('M28 60 h44 l-6 34 h-32 z', '#E8A85A') + iz('M28 68 h44', M, 3); };
  D.pillow = function () { return p('M10 26 q20 6 40 0 q20 6 40 0 q-6 24 0 48 q-20 -6 -40 0 q-20 -6 -40 0 q6 -24 0 -48 z', '#B9C7FF') + yildiz(50, 50, 10, '#FFD23F') + iz('M22 38 q4 2 8 0 M70 62 q4 2 8 0', '#8E9FE8', 2.4); };

  /* ---------------- School · ikinci kat ---------------- */
  D.notebook = function () { return r(22, 10, 60, 80, 6, '#4CC38A') + r(30, 24, 44, 22, 3, '#fff') + iz('M36 32 h32 M36 40 h24', '#9AA7BD', 2.4) + [18, 32, 46, 60, 74].map(function (y) { return '<circle cx="22" cy="' + y + '" r="4" fill="#fff" stroke="' + M + '" stroke-width="2.4"/>'; }).join(''); };
  D.pen = function () { return g('rotate(-40 50 50)', r(14, 42, 58, 16, 6, '#2E7DD8') + r(14, 40, 22, 20, 6, '#1E5FA8') + p('M72 42 L90 50 L72 58 Z', '#C7CCD6') + iz('M84 50 h6', M, 2) + r(24, 36, 6, 8, 2, '#C7CCD6')); };
  D.sharpener = function () { return r(22, 30, 56, 44, 8, '#E5484D') + c(44, 52, 11, '#fff') + n(44, 52, 4) + r(60, 40, 12, 24, 2, '#C7CCD6') + iz('M52 76 l10 12 M60 74 l10 12', '#C98A4B', 3); };
  D.chalk = function () { return r(10, 74, 80, 10, 3, '#C98A4B') + g('rotate(-14 30 60)', r(16, 56, 34, 12, 5, '#fff')) + g('rotate(10 64 58)', r(48, 54, 34, 12, 5, '#FFC9D4')) + r(36, 40, 30, 12, 5, '#BDE8F2'); };
  D.paints = function () { return p('M50 12 q38 0 40 34 q0 14 -14 14 q-10 0 -10 10 q0 16 -18 16 q-38 0 -38 -36 q0 -38 40 -38 z', '#E8A85A') + c(32, 34, 6, '#E5484D') + c(50, 26, 6, '#FFD23F') + c(68, 34, 6, '#4AA8FF') + c(30, 54, 6, '#4CC38A') + c(48, 60, 6, '#8E7CF0') + iz('M70 92 l18 -30', '#C98A4B', 4) + p('M86 60 l6 -10 l4 4 z', '#E5484D'); };
  D.globe = function () { return iz('M22 44 a30 30 0 0 0 54 20', M, 3) + iz('M50 78 v10', M, 4) + e(50, 92, 18, 5, '#C98A4B') + c(50, 44, 28, '#4AA8FF') + p('M36 26 q10 -4 14 4 q-2 8 -10 8 q-8 4 -6 12 q-8 -4 -6 -14 z', '#4CC38A') + p('M56 48 q10 -4 14 4 q0 10 -10 14 q-6 -6 -4 -18 z', '#4CC38A'); };
  D.computer = function () { return r(10, 10, 80, 54, 6, '#5B6478') + r(16, 16, 68, 42, 3, '#BDE8F2') + p('M30 46 l10 -12 l8 8 l6 -6 l10 10 z', '#4CC38A') + c(70, 26, 5, '#FFD23F') + r(42, 64, 16, 10, 0, '#9AA7BD') + r(16, 76, 68, 14, 4, '#E3E8F2') + iz('M24 83 h52', '#9AA7BD', 2.4); };
  D.lunchbox = function () { return iz('M38 26 q0 -14 12 -14 q12 0 12 14', M, 4) + r(12, 26, 76, 60, 10, '#FFD23F') + iz('M12 42 h76', M, 3) + g('translate(36 46) scale(.3)', ai('apple')); };
  D.stapler = function () { return p('M10 70 h80 v12 h-80 z', '#5B6478') + p('M12 66 q0 -22 24 -22 h44 q10 0 10 10 v8 q0 4 -4 4 h-74 z', '#E5484D') + iz('M30 58 h50', '#fff', 3); };
  D.paper = function () { return p('M22 8 h40 l18 18 v66 h-58 z', '#fff') + p('M62 8 v18 h18', '#E3E8F2') + iz('M32 38 h38 M32 50 h38 M32 62 h38 M32 74 h24', '#9AA7BD', 2.4); };

  /* ---------------- Weather · ikinci kat ---------------- */
  D.sun = function () { return gunes(50, 50, 24) + goz2(42, 58, 48, 2.6) + gul(43, 56, 7); };
  D.cloud = function () { return bulut(6, 26, 1.3, '#fff') + goz2(42, 58, 56, 2.6) + gul(44, 62, 6); };
  D.rain = function () { return [[20, 14], [44, 8], [68, 16], [30, 42], [56, 38], [80, 44], [18, 70], [44, 68], [70, 72]].map(function (x) { return damla(x[0], x[1]); }).join(''); };
  D.snow = function () { return kar(50, 50, 28) + kar(18, 18, 8) + kar(84, 80, 8) + kar(82, 18, 6) + kar(16, 82, 6); };
  D.wind = function () { return kalin('M6 30 h56 q16 0 16 -12 q0 -10 -10 -10 q-8 0 -8 8', '#DDF3FF', 6) + kalin('M6 52 h74 q12 0 12 12 q0 10 -10 10 q-8 0 -8 -8', '#DDF3FF', 6) + kalin('M6 74 h40 q10 0 10 8', '#DDF3FF', 6); };
  D.umbrella = function () { return iz('M50 46 V84 q0 8 -8 8 q-7 0 -7 -7', M, 4) + p('M8 50 q42 -54 84 0 q-10 -8 -21 0 q-10 -8 -21 0 q-10 -8 -21 0 q-11 -8 -21 0 z', '#E5484D') + p('M50 8 q-14 14 -13 42 q8 -6 13 0 q5 -6 13 0 q1 -28 -13 -42 z', '#FFD23F'); };
  D.snowman = function () { return c(50, 70, 23, '#fff') + c(50, 36, 16, '#fff') + r(36, 8, 28, 14, 2, M) + r(30, 20, 40, 5, 2, M) + p('M50 38 l14 4 l-14 4 z', '#FF8A3D') + goz2(44, 56, 32, 2.4) + n(50, 62, 2.6) + n(50, 72, 2.6) + iz('M34 50 q16 8 32 0', '#E5484D', 6); };
  D.puddle = function () { return e(50, 76, 42, 14, '#7FCBEA') + e(50, 76, 24, 7, '#BDE8F2') + iz('M30 70 q4 -3 8 0 M60 82 q4 -3 8 0', '#fff', 2.4) + damla(30, 20) + damla(56, 10) + damla(74, 30); };
  D.lightning = function () { return p('M58 4 L22 54 H46 L36 96 L78 40 H54 Z', '#FFD23F') + parlak('M50 14 L34 40'); };
  D.ice = function () { return p('M22 32 l20 -16 h40 l-20 16 z', '#EAF8FF') + p('M62 32 l20 -16 v44 l-20 16 z', '#BDE8F2') + r(22, 32, 40, 44, 4, '#DDF3FF') + iz('M30 42 l8 -6 M30 54 l14 -10', '#fff', 3) + damla(40, 82, '#BDE8F2'); };

  /* ---------------- Fruits ---------------- */
  function yaprak(x, y, rot) { return g('translate(' + x + ' ' + y + ') rotate(' + (rot || 0) + ')', p('M0 0 q10 -12 22 -6 q-8 14 -22 6 z', '#4CC38A')); }
  D.orangefruit = function () { return c(50, 56, 34, '#FF9F1C') + iz('M50 22 v-8', M, 3) + yaprak(52, 16, -10) + '<circle cx="38" cy="50" r="1.6" fill="#E07F00"/><circle cx="60" cy="64" r="1.6" fill="#E07F00"/><circle cx="54" cy="44" r="1.6" fill="#E07F00"/>' + parlak('M30 44 q4 -10 12 -14'); };
  D.grapes = function () { return iz('M52 18 q2 -8 8 -12', M, 3) + yaprak(56, 14, -20) + [[40, 28], [56, 28], [32, 44], [48, 44], [64, 44], [40, 60], [56, 60], [48, 76]].map(function (x) { return c(x[0], x[1], 10, '#8E5AC8') + n(x[0] - 3, x[1] - 3, 2, '#fff'); }).join(''); };
  D.pear = function () { return iz('M50 18 q2 -8 6 -12', M, 3) + p('M50 16 q12 0 12 18 q0 10 10 22 q12 18 0 34 q-10 12 -22 12 q-12 0 -22 -12 q-12 -16 0 -34 q10 -12 10 -22 q0 -18 12 -18 z', '#B5D33D') + yaprak(54, 12, -30) + parlak('M38 60 q0 -10 6 -16'); };
  D.lemon = function () { return p('M8 54 l8 -6 q16 -24 34 -24 q18 0 34 24 l8 6 l-8 6 q-16 24 -34 24 q-18 0 -34 -24 z', '#FFE14D') + yaprak(52, 24, -40) + parlak('M28 46 q8 -12 18 -14'); };
  D.watermelon = function () { return p('M6 34 h88 q0 48 -44 48 q-44 0 -44 -48 z', '#4CC38A') + p('M14 34 h72 q0 38 -36 38 q-36 0 -36 -38 z', '#FF5A6E') + [[30, 44], [44, 52], [58, 46], [68, 40], [50, 62], [36, 58]].map(function (x) { return '<ellipse cx="' + x[0] + '" cy="' + x[1] + '" rx="2" ry="3" fill="' + M + '"/>'; }).join(''); };
  D.cherries = function () { return iz('M36 60 q4 -30 22 -48 M64 64 q2 -30 -6 -52', '#3FB86A', 3) + yaprak(58, 12, 10) + c(34, 68, 15, '#E5484D') + c(64, 70, 15, '#E5484D') + n(28, 62, 3, '#fff') + n(58, 64, 3, '#fff'); };
  D.pineapple = function () { return p('M50 34 l-14 -26 l10 10 l4 -16 l4 16 l10 -10 z', '#4CC38A') + e(50, 64, 26, 32, '#FFC93D') + iz('M30 50 l40 30 M28 66 l30 24 M34 38 l40 32 M70 50 l-40 30 M72 66 l-30 24 M66 38 l-40 32', '#E0A21A', 2.4); };
  D.peach = function () { return c(50, 56, 33, '#FFB08A') + iz('M50 24 q-10 30 0 64', '#F08A64', 3) + yaprak(52, 20, -20) + '<circle cx="66" cy="52" r="10" fill="#FF8A80" opacity=".5"/>'; };
  D.kiwi = function () { return c(50, 50, 38, '#8F6740') + c(50, 50, 31, '#9ED35A') + c(50, 50, 11, '#F3F7D0') + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (i) { var a = i * Math.PI / 6; return '<ellipse cx="' + (50 + 18 * Math.cos(a)).toFixed(1) + '" cy="' + (50 + 18 * Math.sin(a)).toFixed(1) + '" rx="1.6" ry="2.6" transform="rotate(' + (i * 30 + 90) + ' ' + (50 + 18 * Math.cos(a)).toFixed(1) + ' ' + (50 + 18 * Math.sin(a)).toFixed(1) + ')" fill="' + M + '"/>'; }).join(''); };
  D.mango = function () { return p('M28 28 q30 -24 48 4 q16 28 -6 52 q-24 22 -42 0 q-16 -26 0 -56 z', '#FFB020') + '<ellipse cx="64" cy="40" rx="12" ry="9" fill="#FF7A50" opacity=".55"/>' + iz('M48 18 q0 -8 6 -12', M, 3) + yaprak(52, 12, -10); };

  /* ---------------- Transport ---------------- */
  function teker(x, y, k) { return c(x, y, k, M) + c(x, y, k * 0.45, '#C7CCD6'); }
  D.bus = function () { return r(6, 22, 88, 54, 8, '#FFD23F') + r(12, 30, 16, 16, 2, '#BDE8F2') + r(32, 30, 16, 16, 2, '#BDE8F2') + r(52, 30, 16, 16, 2, '#BDE8F2') + r(74, 30, 14, 32, 2, '#BDE8F2') + iz('M6 56 h66', '#E5484D', 4) + teker(26, 78, 9) + teker(72, 78, 9); };
  D.plane = function () { return p('M44 46 L30 14 h10 l20 32 z', '#E5484D') + p('M44 56 L30 88 h10 l20 -32 z', '#E5484D') + p('M8 42 l10 8 l-10 8 z', '#4AA8FF') + p('M10 46 h70 q12 0 14 4 q-2 4 -14 4 h-70 z', '#fff') + c(56, 50, 2.6, '#4AA8FF') + c(66, 50, 2.6, '#4AA8FF') + c(46, 50, 2.6, '#4AA8FF') + c(36, 50, 2.6, '#4AA8FF'); };
  D.ship = function () { return iz('M2 90 q12 -6 24 0 t24 0 t24 0 t24 0', '#4AA8FF', 3) + r(30, 44, 40, 18, 3, '#fff') + r(36, 48, 6, 6, 1, '#BDE8F2') + r(48, 48, 6, 6, 1, '#BDE8F2') + r(60, 48, 6, 6, 1, '#BDE8F2') + r(46, 24, 12, 20, 2, '#E5484D') + c(52, 14, 5, '#E3E8F2') + c(60, 8, 4, '#E3E8F2') + p('M8 62 h84 l-14 22 h-56 z', '#2E7DD8'); };
  D.bike = function () { return '<circle cx="24" cy="66" r="17" fill="none" stroke="' + M + '" stroke-width="4"/><circle cx="76" cy="66" r="17" fill="none" stroke="' + M + '" stroke-width="4"/>' + iz('M24 66 L40 40 H66 L76 66 M40 40 L52 66 L66 40 M52 66 H24', '#4CC38A', 4) + iz('M36 34 h12 M66 40 l-4 -14 h10', M, 4); };
  D.helicopter = function () { return iz('M8 14 h84 M50 14 v14', M, 4) + p('M70 50 h22 l4 -10 h4 l-2 20 h-28 z', '#4AA8FF') + e(46, 54, 28, 20, '#4AA8FF') + p('M50 40 q16 0 20 14 h-20 z', '#BDE8F2') + iz('M28 82 h40 M36 74 v8 M56 74 v8', M, 4); };
  D.taxi = function () { return r(38, 18, 24, 10, 2, '#fff') + yazi(50, 26, 'TAXI', 8, M) + p('M10 58 q4 -18 18 -22 h40 q16 4 22 22 v14 h-80 z', '#FFD23F') + r(30, 40, 18, 14, 2, '#BDE8F2') + r(52, 40, 18, 14, 2, '#BDE8F2') + iz('M10 62 h80', M, 2) + '<path d="M10 64 h8 v4 h-8 z M26 64 h8 v4 h-8 z M42 64 h8 v4 h-8 z M58 64 h8 v4 h-8 z M74 64 h8 v4 h-8 z" fill="' + M + '"/>' + teker(28, 74, 9) + teker(72, 74, 9); };
  D.tractor = function () { return r(46, 30, 26, 30, 3, '#4CC38A') + r(50, 34, 18, 14, 2, '#BDE8F2') + r(24, 48, 64, 18, 4, '#4CC38A') + iz('M30 48 V30', M, 4) + teker(32, 70, 20) + teker(80, 78, 11); };
  D.truck = function () { return r(6, 26, 58, 44, 4, '#9AA7BD') + p('M64 40 h18 l12 14 v16 h-30 z', '#E5484D') + r(68, 44, 12, 10, 2, '#BDE8F2') + teker(22, 74, 9) + teker(48, 74, 9) + teker(80, 74, 9); };
  D.rocket = function () { return p('M40 76 q10 24 20 0 z', '#FF8A3D') + p('M44 76 q6 14 12 0 z', '#FFD23F') + p('M30 62 l-10 16 h14 z M70 62 l10 16 h-14 z', '#E5484D') + p('M50 6 q22 22 20 56 v14 h-40 v-14 q-2 -34 20 -56 z', '#fff') + c(50, 40, 8, '#4AA8FF') + p('M42 18 q8 -8 16 0 z', '#E5484D'); };
  D.motorbike = function () { return teker(20, 70, 14) + teker(80, 70, 14) + p('M30 60 q8 -18 26 -18 h12 l12 26 h-16 l-8 -10 h-14 z', '#E5484D') + r(34, 36, 22, 8, 4, M) + iz('M70 42 l6 -12 h8', M, 4) + c(84, 46, 4, '#FFD23F'); };

  /* ---------------- Shapes ---------------- */
  function sekil(ic) { return ic + goz2(42, 58, 50, 3) + gul(44, 58, 6); }
  D.circle = function () { return sekil(c(50, 50, 38, '#4AA8FF')); };
  D.square = function () { return sekil(r(14, 14, 72, 72, 4, '#E5484D')); };
  D.triangle = function () { return sekil(p('M50 8 L92 86 H8 Z', '#4CC38A').replace('d="M50 8', 'd="M50 8')) ; };
  D.rectangle = function () { return sekil(r(6, 26, 88, 50, 4, '#FF8A3D')); };
  D.star = function () { return yildiz(50, 54, 44, '#FFD23F') + goz2(42, 58, 54, 3) + gul(44, 62, 6); };
  D.heart = function () { return p('M50 30 q-16 -24 -34 -12 q-18 14 0 40 q14 18 34 30 q20 -12 34 -30 q18 -26 0 -40 q-18 -12 -34 12 z', '#FF6FA5') + goz2(40, 60, 46, 3) + gul(44, 56, 6); };
  D.oval = function () { return sekil(e(50, 50, 42, 28, '#8E7CF0')); };
  D.diamond = function () { return sekil(p('M50 6 L90 50 L50 94 L10 50 Z', '#2EB5A8')); };

  /* ---------------- Sea ---------------- */
  D.whale = function () { return iz('M44 20 q-6 -10 0 -14 M44 20 q6 -10 12 -12', '#4AA8FF', 3) + p('M86 40 l10 -14 l2 18 z', '#4A7FD8') + p('M8 60 q0 -34 44 -34 q38 0 40 30 q0 28 -42 28 q-42 0 -42 -24 z', '#4A7FD8') + p('M14 66 q34 16 70 0 q-6 18 -34 18 q-30 0 -36 -18 z', '#BDE8F2') + n(28, 50, 3.4) + gul(20, 60, 6); };
  D.dolphin = function () { return p('M8 70 q20 -46 64 -40 q14 2 24 10 q-8 4 -18 2 q4 20 -14 32 q-28 18 -56 -4 z', '#7FB7E8') + p('M48 32 l6 -18 l10 18 z', '#7FB7E8') + p('M10 72 l-6 12 l14 -4 z', '#7FB7E8') + n(70, 40, 3) + gul(76, 46, 4) + iz('M24 70 q20 8 40 -6', '#DDF3FF', 4); };
  D.octopus = function () { return [18, 34, 50, 66, 82].map(function (x, i) { return kalin('M' + x + ' 54 q' + (i % 2 ? 8 : -8) + ' 18 0 26 q' + (i % 2 ? -6 : 6) + ' 8 2 12', '#FF7AAE', 9); }).join('') + e(50, 38, 30, 28, '#FF7AAE') + goz2(40, 60, 38, 4) + gul(44, 48, 6) + '<circle cx="30" cy="22" r="3" fill="#FFB3D0"/><circle cx="66" cy="20" r="4" fill="#FFB3D0"/>'; };
  D.crab = function () { return iz('M24 66 l-14 10 M26 74 l-12 14 M76 66 l14 10 M74 74 l12 14', M, 4) + iz('M30 50 l-12 -20 M70 50 l12 -20', M, 4) + p('M8 22 q8 -14 20 -4 l-10 6 l12 2 q-8 14 -22 -4 z', '#FF6B5B') + p('M92 22 q-8 -14 -20 -4 l10 6 l-12 2 q8 14 22 -4 z', '#FF6B5B') + iz('M42 46 v-12 M58 46 v-12', M, 3) + c(42, 30, 5, '#fff') + c(58, 30, 5, '#fff') + n(42, 30, 2.4) + n(58, 30, 2.4) + e(50, 60, 30, 18, '#FF6B5B') + gul(44, 62, 6); };
  D.shark = function () { return iz('M2 88 q12 -6 24 0 t24 0 t24 0 t24 0', '#4AA8FF', 3) + p('M84 52 l12 -18 v38 z', '#8A94A8') + p('M44 30 l10 -22 l10 24 z', '#8A94A8') + p('M8 56 q20 -28 52 -26 q30 2 34 22 q-6 22 -40 24 q-34 2 -46 -20 z', '#8A94A8') + p('M10 58 q30 12 70 4 q-10 14 -36 14 q-26 0 -34 -18 z', '#fff') + p('M20 60 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6', '#fff') + n(28, 46, 3.4); };
  D.turtle = function () { return c(86, 56, 10, '#9ED35A') + n(89, 53, 2.2) + e(26, 76, 9, 6, '#9ED35A') + e(70, 78, 9, 6, '#9ED35A') + e(22, 42, 8, 6, '#9ED35A') + e(50, 56, 32, 26, '#4CC38A') + p('M36 46 l14 -10 l14 10 l-4 16 h-20 z', '#3FB86A') + iz('M36 46 l-14 4 M64 46 l14 4 M40 62 l-8 12 M60 62 l8 12', '#2E9D62', 2.4); };
  D.starfish = function () { return yildizYol(50, 54, 44, 20, 5) + ' fill="#FF8A3D" ' + S + '/>' + '<circle cx="50" cy="22" r="2" fill="#FFD9B0"/><circle cx="24" cy="44" r="2" fill="#FFD9B0"/><circle cx="76" cy="44" r="2" fill="#FFD9B0"/><circle cx="34" cy="76" r="2" fill="#FFD9B0"/><circle cx="66" cy="76" r="2" fill="#FFD9B0"/>' + goz2(44, 56, 52, 2.6) + gul(46, 58, 4); };
  D.jellyfish = function () { return iz('M30 54 q-6 12 2 22 q6 10 -2 18 M44 56 q6 12 -2 22 q-6 10 2 18 M58 56 q-6 12 2 22 q6 10 -2 18 M72 54 q6 12 -2 22', '#C9A7E8', 4) + p('M14 56 q0 -44 36 -44 q36 0 36 44 q-9 -6 -18 0 q-9 -6 -18 0 q-9 -6 -18 0 q-9 -6 -18 0 z', '#C9A7E8') + goz2(40, 60, 38, 3) + gul(44, 46, 6); };
  D.seahorse = function () { return p('M52 10 q20 0 20 18 q0 10 -8 14 q12 10 8 30 q-4 18 -18 18 q-12 0 -12 -10 q0 -8 8 -8 q6 0 6 4 q4 -14 -6 -24 q-8 -8 -2 -20 l-18 -2 q2 -12 22 -20 z', '#FFC94D') + p('M64 44 l12 6 l-10 6 z', '#FFB020') + n(58, 22, 2.8) + iz('M50 30 l2 6 M54 50 l4 4 M54 62 l4 2', '#E0A21A', 2.4); };
  D.shell = function () { return p('M50 90 l-38 -36 q2 -40 38 -44 q36 4 38 44 z', '#FFC9D4') + iz('M50 90 V16 M50 90 L30 22 M50 90 L70 22 M50 90 L18 40 M50 90 L82 40', '#F28AAE', 2.6) + r(40, 86, 20, 8, 3, '#FFC9D4'); };

  /* ---------------- Jobs ---------------- */
  D.stetoskop = function () { return iz('M30 10 v24 q0 24 20 24 q20 0 20 -24 v-24', M, 4) + iz('M50 58 v14 q0 14 14 14 h8', M, 4) + c(78, 86, 9, '#C7CCD6') + c(30, 10, 4, '#C7CCD6') + c(70, 10, 4, '#C7CCD6'); };
  D.yangin = function () { return p('M50 6 q26 24 22 52 q-2 30 -22 34 q-20 -4 -22 -34 q-2 -18 10 -30 q2 14 8 16 q-4 -20 4 -38 z', '#FF8A3D') + p('M50 46 q12 12 10 26 q-2 14 -10 16 q-8 -2 -10 -16 q0 -12 10 -26 z', '#FFD23F'); };
  D.polisrozet = function () { return yildizYol(50, 50, 40, 26, 6) + ' fill="#FFD23F" ' + S + '/>' + c(50, 50, 16, '#2E4A8C') + yildiz(50, 51, 9, '#FFD23F'); };
  D.cekic = function () { return g('rotate(-35 50 50)', r(44, 34, 12, 60, 4, '#C98A4B') + r(22, 14, 56, 22, 5, '#9AA7BD') + iz('M30 20 h12', '#fff', 3)); };
  D.yarabandi = function () { return g('rotate(-30 50 50)', r(6, 36, 88, 28, 12, '#FFC2A1') + r(34, 36, 32, 28, 4, '#FFE6D6') + n(42, 44, 1.8, '#E8A88A') + n(58, 44, 1.8, '#E8A88A') + n(42, 56, 1.8, '#E8A88A') + n(58, 56, 1.8, '#E8A88A')); };
  function meslek(o, ek, on) { return (on || '') + kisi(o) + (ek || ''); }
  D.doctor = function () { return meslek({ stil: 'kisa', sac: '#3B2A22', ust: '#fff' }, iz('M36 74 q-2 14 8 16 M64 74 q2 14 -8 16', M, 3) + c(44, 90, 3, '#C7CCD6') + r(58, 80, 12, 12, 2, '#fff') + iz('M64 82 v8 M60 86 h8', '#E5484D', 3)); };
  D.teacher = function () { return meslek({ stil: 'topuz', sac: '#8F5A3A', ust: '#8E7CF0', gozluk: 1 }, r(58, 74, 26, 20, 3, '#4AA8FF') + yazi(71, 88, 'ABC', 9)); };
  D.chef = function () { return meslek({ stil: 'kisa', sac: '#3B2A22', ust: '#fff' }, p('M32 30 q-12 -2 -10 -12 q2 -10 14 -6 q4 -12 14 -12 q10 0 14 12 q12 -4 14 6 q2 10 -10 12 z', '#fff') + r(32, 24, 36, 9, 2, '#fff') + iz('M44 78 v14 M56 78 v14', '#E5484D', 3)); };
  D.firefighter = function () { return meslek({ stil: 'kisa', sac: '#3B2A22', ust: '#E5484D' }, p('M24 34 q0 -24 26 -24 q26 0 26 24 l8 4 h-68 z', '#FFD23F') + r(44, 14, 12, 10, 2, '#E5484D') + iz('M30 84 h40', '#FFD23F', 4)); };
  D.police = function () { return meslek({ stil: 'kisa', sac: '#3B2A22', ust: '#2E4A8C' }, p('M26 30 q24 -22 48 0 v6 h-48 z', '#2E4A8C') + r(26, 32, 48, 6, 2, '#1E2F5C') + yildiz(50, 24, 5, '#FFD23F') + yildiz(62, 84, 6, '#FFD23F')); };
  D.farmer = function () { return meslek({ stil: 'kisa', sac: '#C9773A', ust: '#4CC38A' }, e(50, 28, 34, 7, '#F2D27A') + p('M32 28 q0 -18 18 -18 q18 0 18 18 z', '#F2D27A') + iz('M34 26 h32', '#E5484D', 3) + iz('M38 72 v24 M62 72 v24', '#2E7DD8', 5)); };
  D.pilot = function () { return meslek({ stil: 'kisa', sac: '#3B2A22', ust: '#2E4A8C' }, p('M28 30 q22 -20 44 0 v6 h-44 z', '#fff') + r(26, 32, 48, 6, 2, '#1E2F5C') + p('M40 84 h20 l-4 4 h-12 z', '#FFD23F') + iz('M34 84 h6 M60 84 h6', '#FFD23F', 3)); };
  D.builder = function () { return meslek({ stil: 'kisa', sac: '#5B3A22', ust: '#FF8A3D' }, p('M26 32 q0 -24 24 -24 q24 0 24 24 z', '#FFD23F') + r(22, 30, 56, 6, 3, '#FFD23F') + iz('M36 76 v20 M64 76 v20', '#fff', 4)); };
  D.nurse = function () { return meslek({ stil: 'uzun', sac: '#8F5A3A', ust: '#7FD3E6' }, p('M34 22 h32 l-4 -12 h-24 z', '#fff') + iz('M50 12 v8 M46 16 h8', '#E5484D', 2.6)); };
  D.vet = function () { return meslek({ stil: 'kuyruk', sac: '#C9773A', ust: '#4CC38A' }, g('translate(52 60) scale(.42)', icAl(C.avatar('kopek')))); };

  /* ---------------- Actions: tek çocuk figürü, poza göre ---------------- */
  function cocuk(o) {
    var gom = '#4AA8FF', bac = '#2E7DD8', h = '';
    (o.bacak || []).forEach(function (d) { h += kalin(d, bac, 8); });
    h += kalin(o.govde, gom, 14);
    (o.kol || []).forEach(function (d) { h += kalin(d, TEN, 7); });
    h += c(o.bas[0], o.bas[1], 12, TEN) + p('M' + (o.bas[0] - 12) + ' ' + (o.bas[1] - 2) + ' q0 -12 12 -12 q12 0 12 12 q-6 -6 -12 -5 q-6 -1 -12 5 z', '#8F5A3A');
    h += o.uyku ? iz('M' + (o.bas[0] - 6) + ' ' + (o.bas[1] + 1) + ' h4 M' + (o.bas[0] + 2) + ' ' + (o.bas[1] + 1) + ' h4', M, 2.4) : n(o.bas[0] - 4, o.bas[1] + 1, 1.8) + n(o.bas[0] + 4, o.bas[1] + 1, 1.8);
    h += o.agiz === 'acik' ? e(o.bas[0], o.bas[1] + 7, 3, 3.4, '#7A2F3A') : iz('M' + (o.bas[0] - 3) + ' ' + (o.bas[1] + 6) + ' q3 3 6 0', M, 2);
    return (o.arka || '') + h + (o.on || '');
  }
  D.run = function () { return iz('M8 40 h12 M4 52 h12 M10 64 h10', '#9AA7BD', 3) + cocuk({ bas: [58, 20], govde: 'M56 34 L48 58', kol: ['M54 40 L66 48 L74 38', 'M54 40 L40 46 L34 56'], bacak: ['M48 58 L62 72 L58 88', 'M48 58 L36 74 L22 76'] }); };
  D.jump = function () { return e(50, 94, 16, 3.4, '#C7CCD6') + iz('M30 86 l-6 6 M70 86 l6 6', '#9AA7BD', 3) + cocuk({ bas: [50, 16], govde: 'M50 30 V54', kol: ['M50 36 L36 20', 'M50 36 L64 20'], bacak: ['M50 54 L40 66 L46 78', 'M50 54 L60 66 L54 78'], agiz: 'acik' }); };
  D.swim = function () { return cocuk({ bas: [26, 48], govde: 'M36 54 H64', kol: ['M42 54 L54 40 L66 34', 'M42 56 L30 66'], bacak: ['M64 54 L82 50', 'M64 56 L84 60'] }) + iz('M2 62 q8 -6 16 0 t16 0 t16 0 t16 0 t16 0 t16 0', '#4AA8FF', 4) + iz('M6 76 q8 -6 16 0 t16 0 t16 0 t16 0 t16 0', '#7FCBEA', 4); };
  D.sing = function () { return cocuk({ bas: [44, 22], govde: 'M44 36 V62', kol: ['M44 42 L58 48 L60 34', 'M44 42 L30 54'], bacak: ['M44 62 L38 90', 'M44 62 L52 90'], agiz: 'acik', on: c(62, 30, 4, M) }) + g('translate(66 6) scale(.3)', hazir('nota')) + g('translate(76 34) scale(.22)', hazir('nota')); };
  D.dance = function () { return cocuk({ bas: [50, 18], govde: 'M50 32 L52 58', kol: ['M50 38 L34 24', 'M50 38 L68 44 L76 34'], bacak: ['M52 58 L44 90', 'M52 58 L70 70 L78 64'], agiz: 'acik' }) + g('translate(8 50) scale(.26)', hazir('nota')) + yildiz(82, 14, 6, '#FFD23F'); };
  D.sleep = function () { return r(6, 54, 88, 20, 4, '#4AA8FF') + r(8, 46, 20, 12, 6, '#fff') + c(20, 42, 11, TEN) + p('M9 40 q0 -11 11 -11 q11 0 11 11 q-5 -5 -11 -4 q-6 -1 -11 4 z', '#8F5A3A') + iz('M15 44 h4 M22 44 h4', M, 2.2) + p('M30 50 h62 v8 h-62 z', '#FFD23F') + iz('M8 74 v14 M92 74 v14', M, 4) + yazi(64, 30, 'Z', 18, '#8E7CF0') + yazi(78, 16, 'Z', 13, '#8E7CF0'); };
  D.eat = function () { return c(50, 40, 26, TEN) + p('M24 36 q0 -26 26 -26 q26 0 26 26 q-10 -12 -26 -10 q-16 -2 -26 10 z', '#8F5A3A') + goz2(40, 60, 38, 3) + e(50, 54, 6, 5, '#7A2F3A') + iz('M66 92 L54 56', '#C7CCD6', 4) + e(52, 52, 6, 4, '#C7CCD6') + p('M20 76 h60 q0 18 -30 18 q-30 0 -30 -18 z', '#4CC38A'); };
  D.read = function () { return cocuk({ bas: [50, 20], govde: 'M50 34 V62', kol: ['M50 40 L36 52', 'M50 40 L64 52'], bacak: ['M50 62 L42 90', 'M50 62 L58 90'] }) + g('translate(26 38) scale(.48)', ai('book')); };
  D.draw = function () { return r(10, 34, 62, 52, 3, '#fff') + p('M18 74 l10 -18 l8 10 l8 -14 l12 22 z', '#4CC38A') + c(54, 46, 6, '#FFD23F') + g('rotate(30 74 40)', r(64, 26, 12, 40, 3, '#E5484D') + p('M64 66 L70 78 L76 66 Z', '#FFE6B8')) + c(80, 30, 10, TEN); };
  D.climb = function () { return iz('M24 4 V96 M60 4 V96 M24 18 H60 M24 38 H60 M24 58 H60 M24 78 H60', '#C98A4B', 5) + cocuk({ bas: [44, 26], govde: 'M44 40 V62', kol: ['M44 44 L30 36 L26 30', 'M44 44 L58 38 L60 28'], bacak: ['M44 62 L32 70 L30 78', 'M44 62 L56 60 L58 58'] }); };

  /* ---------------- Seasons ---------------- */
  function agac(tepe, ek) { return r(44, 54, 12, 38, 3, '#B07A40') + c(50, 40, 30, tepe) + (ek || ''); }
  D.yaprak = function () { return p('M50 92 q-40 -30 -14 -70 q16 -20 14 -18 q2 -2 14 18 q26 40 -14 70 z', '#FF8A3D') + iz('M50 92 V20 M50 50 l-14 -10 M50 64 l14 -12', '#C9612A', 2.6); };
  D.spring = function () { return agac('#9ED35A', c(36, 30, 5, '#FFB3D0') + c(58, 26, 5, '#FFB3D0') + c(64, 46, 5, '#FFB3D0') + c(42, 50, 5, '#FFB3D0')) + g('translate(4 66) scale(.26)', hazir('cicek')) + g('translate(72 66) scale(.26)', hazir('cicek')); };
  D.summer = function () { return gunes(80, 18, 10) + iz('M2 72 q12 -6 24 0 t24 0 t24 0 t24 0', '#4AA8FF', 4) + p('M0 80 h100 v20 h-100 z', '#FFE08A') + iz('M30 80 V36', M, 3) + p('M8 40 q22 -26 44 0 z', '#E5484D') + c(70, 88, 6, '#FF8A3D'); };
  D.autumn = function () { return agac('#FF8A3D', c(34, 36, 4, '#E5484D') + c(62, 30, 4, '#FFD23F') + c(56, 50, 4, '#E5484D')) + g('translate(10 70) rotate(-20) scale(.18)', ai('yaprak')) + g('translate(74 72) rotate(30) scale(.18)', ai('yaprak')); };
  D.winter = function () { return p('M0 84 q50 -14 100 0 v16 h-100 z', '#fff') + r(46, 74, 8, 14, 2, '#B07A40') + p('M50 6 L74 44 H62 L82 76 H18 L38 44 H26 Z', '#3FB86A') + p('M50 6 L62 26 q-12 6 -24 0 Z', '#fff') + iz('M30 72 q10 -6 20 0 q10 -6 20 0 M36 42 q7 -4 14 0 q7 -4 14 0', '#fff', 4) + kar(14, 20, 5) + kar(88, 26, 5) + kar(86, 60, 4); };

  /* ---------------- Days: takvim yaprağı ---------------- */
  var GUN_R = { monday: '#4AA8FF', tuesday: '#4CC38A', wednesday: '#FFD23F', thursday: '#FF8A3D', friday: '#8E7CF0', saturday: '#FF6FA5', sunday: '#E5484D' };
  Object.keys(GUN_R).forEach(function (k) {
    D[k] = function () { return r(14, 10, 72, 80, 10, '#fff') + p('M14 30 v-10 q0 -10 10 -10 h52 q10 0 10 10 v10 z', GUN_R[k]) + iz('M32 6 v10 M68 6 v10', M, 4) + yazi(50, 64, k.slice(0, 3).toUpperCase(), 26, GUN_R[k]) + (k === 'saturday' || k === 'sunday' ? yildiz(50, 80, 6, '#FFD23F') : iz('M38 80 h24', '#E3E8F2', 4)); };
  });

  /* ---------------- Places: top ve kutu ---------------- */
  var kutuOn = r(28, 50, 46, 38, 4, '#C98A4B') + iz('M28 62 h46', '#B07A40', 3), top_ = function (x, y) { return c(x, y, 11, '#E5484D') + iz('M' + (x - 9) + ' ' + (y - 3) + ' q9 6 18 0', '#fff', 2.4); };
  D['in'] = function () { return r(28, 50, 46, 38, 4, '#B07A40') + top_(51, 52) + p('M28 60 h46 v28 h-46 z', '#C98A4B') + iz('M28 60 l-8 -12 M74 60 l8 -12', M, 3); };
  D.on = function () { return kutuOn + top_(51, 38); };
  D.under = function () { return r(10, 30, 80, 10, 3, '#C98A4B') + r(16, 40, 7, 50, 2, '#B07A40') + r(77, 40, 7, 50, 2, '#B07A40') + top_(50, 78); };
  D.next = function () { return kutuOn + top_(86, 76); };
  D.behind = function () { return top_(60, 46) + kutuOn; };
  D.front = function () { return r(30, 30, 46, 38, 4, '#C98A4B') + iz('M30 42 h46', '#B07A40', 3) + top_(52, 78); };

  /* ---------------- Alphabet ---------------- */
  D.queen = function () { return kisi({ stil: 'uzun', sac: '#C9773A', ust: '#8E7CF0' }) + p('M32 26 L32 8 L41 18 L50 4 L59 18 L68 8 L68 26 Z', '#FFD23F') + c(50, 18, 2.4, '#E5484D'); };
  D.van = function () { return p('M6 30 h60 q14 0 22 16 l6 10 v18 h-88 z', '#FFFFFF') + r(68, 36, 16, 14, 3, '#BDE8F2') + iz('M6 58 h88', '#4AA8FF', 5) + teker(24, 76, 9) + teker(74, 76, 9); };
  D.xylophone = function () { return ['#E5484D', '#FF8A3D', '#FFD23F', '#4CC38A', '#4AA8FF', '#8E7CF0'].map(function (f, i) { return r(8 + i * 14, 18 + i * 5, 12, 64 - i * 10, 3, f); }).join('') + iz('M10 30 h80 M10 74 h80', M, 2) + g('rotate(30 70 80)', r(66, 66, 5, 30, 2, '#C98A4B')) + c(72, 64, 5, '#fff'); };
  D.zebra = function () { return p('M34 24 l4 -16 l8 14 z M66 24 l-4 -16 l-8 14 z', '#fff') + e(50, 48, 24, 30, '#fff') + iz('M30 34 h12 M58 34 h12 M28 46 h10 M62 46 h10 M30 58 h10 M60 58 h10', M, 4) + p('M40 16 q10 -8 20 0 l-4 12 h-12 z', M) + e(50, 74, 16, 11, '#9AA7BD') + n(44, 74, 2.4) + n(56, 74, 2.4) + goz2(42, 58, 44, 3); };
  var HARF = { a: 'apple', b: 'ball', c: 'cat', d: 'dog', e: 'egg', f: 'fish', g: 'grapes', h: 'hat', i: 'icecream', j: 'juice', k: 'kite', l: 'lion', m: 'milk', n: 'nose', o: 'octopus', p: 'pencil', q: 'queen', r: 'rabbit', s: 'sun', t: 'teddy', u: 'umbrella', v: 'van', w: 'window', x: 'xylophone', y: 'yoyo', z: 'zebra' };
  var HARF_R = ['#E5484D', '#FF8A3D', '#E8B820', '#3FB86A', '#2E8FE8', '#8E7CF0', '#FF6FA5'];
  Object.keys(HARF).forEach(function (h, i) {
    D['harf-' + h] = function () { return r(6, 6, 88, 88, 18, '#fff') + yazi(32, 68, h.toUpperCase(), 56, HARF_R[i % 7]) + g('translate(56 46) scale(.42)', ai(HARF[h])); };
  });

  D.lonely = function () { return A.yuz('sad').replace(/<path d="M30 54[^>]*\/>/, ''); };
  Object.keys(D).forEach(function (k) { RS.ekle(k, D[k]); });
  /* yerleştirme kapları: meyve kâsesi, akvaryum */
  RS.kase = function () { return '<svg class="kc ko-kap-r" viewBox="0 0 200 120" aria-hidden="true">' + p('M10 40 h180 q0 76 -90 76 q-90 0 -90 -76 z', '#4AA8FF') + iz('M24 62 q76 22 152 0', '#fff', 4) + e(100, 40, 90, 10, '#BDE8F2') + '</svg>'; };
  RS.akvaryum = function () { return '<svg class="kc ko-kap-r" viewBox="0 0 200 120" aria-hidden="true">' + r(10, 8, 180, 108, 14, '#BDE8F2') + p('M10 40 q45 -10 90 0 t90 0 V102 q0 14 -14 14 H24 q-14 0 -14 -14 Z', '#4AA8FF') + p('M30 116 q10 -30 0 -50 q14 20 8 50 z', '#4CC38A') + p('M160 116 q-8 -26 4 -44 q8 22 2 44 z', '#3FB86A') + '<circle cx="60" cy="70" r="4" fill="#fff" opacity=".7"/><circle cx="70" cy="56" r="3" fill="#fff" opacity=".7"/><circle cx="140" cy="80" r="5" fill="#fff" opacity=".6"/></svg>'; };
  W.KIDS_RESIM.HARF = HARF;
})(window);
