/* ==========================================================================
   ACADEX KIDS · çizimler (kids/assets/kids-ciz.js), 10.11.2026
   Tek çizim dili: kalın lacivert kontur, düz renk, yuvarlak köşe. Hepsi SVG, dışarıdan
   görsel yok. Mini Acadia (maskot), hayvan avatarlar, resimli şifre simgeleri, adalar,
   bulut, balon, boya lekesi. W.KIDS_CIZ
   ========================================================================== */
(function (W) {
  'use strict';
  var M = '#23304D';   /* mürekkep */
  function svg(vb, ic, cls, ek) { return '<svg class="kc ' + (cls || '') + '" viewBox="' + vb + '" aria-hidden="true" focusable="false"' + (ek || '') + '>' + ic + '</svg>'; }
  function yildizNokta(cx, cy, R, r) {
    var p = []; for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r : R; p.push((cx + q * Math.cos(a)).toFixed(1) + ',' + (cy + q * Math.sin(a)).toFixed(1)); }
    return p.join(' ');
  }

  /* ---------- Mini Acadia ---------- */
  var GOZ = {
    mutlu: '<ellipse cx="41" cy="50" rx="4.2" ry="5.4" fill="' + M + '"/><ellipse cx="59" cy="50" rx="4.2" ry="5.4" fill="' + M + '"/><circle cx="42.6" cy="48" r="1.6" fill="#fff"/><circle cx="60.6" cy="48" r="1.6" fill="#fff"/>',
    kutlama: '<path d="M36 51 q5 -7 10 0 M54 51 q5 -7 10 0" fill="none" stroke="' + M + '" stroke-width="3" stroke-linecap="round"/>',
    dusun: '<ellipse cx="42" cy="49" rx="4" ry="5" fill="' + M + '"/><ellipse cx="60" cy="49" rx="4" ry="5" fill="' + M + '"/><circle cx="43.5" cy="47" r="1.5" fill="#fff"/><circle cx="61.5" cy="47" r="1.5" fill="#fff"/><path d="M36 41 l9 -2 M55 39 l9 2" stroke="' + M + '" stroke-width="2.4" stroke-linecap="round"/>',
    uyku: '<path d="M36 50 q5 4 10 0 M54 50 q5 4 10 0" fill="none" stroke="' + M + '" stroke-width="3" stroke-linecap="round"/>'
  };
  var AGIZ = {
    mutlu: '<path d="M44 59 q6 7 12 0" fill="none" stroke="' + M + '" stroke-width="3" stroke-linecap="round"/>',
    kutlama: '<path d="M43 58 q7 11 14 0 z" fill="#E5484D" stroke="' + M + '" stroke-width="2.6" stroke-linejoin="round"/>',
    dusun: '<circle cx="51" cy="61" r="2.6" fill="none" stroke="' + M + '" stroke-width="2.6"/>',
    uyku: '<path d="M46 60 q4 3 8 0" fill="none" stroke="' + M + '" stroke-width="2.6" stroke-linecap="round"/>'
  };
  function acadia(o) {
    o = o || {}; var mood = GOZ[o.mood] ? o.mood : 'mutlu', pts = yildizNokta(50, 52, 37, 20);
    var kol = o.mood === 'kutlama'
      ? '<path d="M20 44 q-9 -9 -6 -19 M80 44 q9 -9 6 -19" fill="none" stroke="' + M + '" stroke-width="3.2" stroke-linecap="round"/>'
      : (o.pose === 'isaret' ? '<path d="M80 46 q10 -4 14 -14" fill="none" stroke="' + M + '" stroke-width="3.2" stroke-linecap="round"/><circle cx="94" cy="31" r="3" fill="#FFD23F" stroke="' + M + '" stroke-width="2"/>' : '');
    return svg('0 0 100 100', '<g class="kc-acadia kc-' + mood + '">' + kol +
      '<polygon points="' + pts + '" fill="' + M + '" stroke="' + M + '" stroke-width="19" stroke-linejoin="round"/>' +
      '<polygon points="' + pts + '" fill="#FFD23F" stroke="#FFD23F" stroke-width="13" stroke-linejoin="round"/>' +
      '<path d="M30 30 q6 -9 16 -9" fill="none" stroke="#FFF1B0" stroke-width="5" stroke-linecap="round"/>' +
      '<ellipse cx="33" cy="58" rx="5" ry="3.4" fill="#FF9E8A"/><ellipse cx="67" cy="58" rx="5" ry="3.4" fill="#FF9E8A"/>' +
      GOZ[mood] + AGIZ[mood] + '</g>', 'kc-acd' + (o.cls ? ' ' + o.cls : ''));
  }

  /* ---------- hayvan avatarlar ---------- */
  var HAYVAN = {
    ayi: { r: '#C98A4B', k: 'yuvarlak', b: '#F3D9B5' }, tavsan: { r: '#F4F1EA', k: 'uzun', b: '#FFC9D4' }, kedi: { r: '#FF9F45', k: 'sivri', b: '#FFE2BF' },
    kopek: { r: '#E9C58E', k: 'sarkik', b: '#FFF3DD' }, panda: { r: '#FFFFFF', k: 'yuvarlak', b: '#FFFFFF', koyu: 1 }, tilki: { r: '#F0703A', k: 'sivri', b: '#FFF3E4' },
    kurbaga: { r: '#5CC97B', k: 'goz', b: '#C9F2C4' }, civciv: { r: '#FFD84D', k: 'yok', b: '#FFD84D', gaga: 1 }
  };
  function avatar(ad) {
    var h = HAYVAN[ad] || HAYVAN.ayi, ks = h.koyu ? M : h.r, kulak = '';
    if (h.k === 'yuvarlak') kulak = '<circle cx="26" cy="26" r="12" fill="' + ks + '" stroke="' + M + '" stroke-width="3"/><circle cx="74" cy="26" r="12" fill="' + ks + '" stroke="' + M + '" stroke-width="3"/>';
    if (h.k === 'uzun') kulak = '<ellipse cx="36" cy="18" rx="8" ry="20" fill="' + h.r + '" stroke="' + M + '" stroke-width="3"/><ellipse cx="64" cy="18" rx="8" ry="20" fill="' + h.r + '" stroke="' + M + '" stroke-width="3"/><ellipse cx="36" cy="18" rx="3" ry="12" fill="' + h.b + '"/><ellipse cx="64" cy="18" rx="3" ry="12" fill="' + h.b + '"/>';
    if (h.k === 'sivri') kulak = '<path d="M18 40 L22 10 L44 26 Z M82 40 L78 10 L56 26 Z" fill="' + h.r + '" stroke="' + M + '" stroke-width="3" stroke-linejoin="round"/>';
    if (h.k === 'sarkik') kulak = '<ellipse cx="18" cy="48" rx="9" ry="20" fill="#A8743A" stroke="' + M + '" stroke-width="3"/><ellipse cx="82" cy="48" rx="9" ry="20" fill="#A8743A" stroke="' + M + '" stroke-width="3"/>';
    if (h.k === 'goz') kulak = '<circle cx="32" cy="24" r="12" fill="' + h.r + '" stroke="' + M + '" stroke-width="3"/><circle cx="68" cy="24" r="12" fill="' + h.r + '" stroke="' + M + '" stroke-width="3"/>';
    var goz = h.k === 'goz'
      ? '<circle cx="32" cy="24" r="5" fill="' + M + '"/><circle cx="68" cy="24" r="5" fill="' + M + '"/><circle cx="33.5" cy="22.5" r="1.6" fill="#fff"/><circle cx="69.5" cy="22.5" r="1.6" fill="#fff"/>'
      : (h.koyu ? '<ellipse cx="36" cy="50" rx="9" ry="11" fill="' + M + '"/><ellipse cx="64" cy="50" rx="9" ry="11" fill="' + M + '"/><circle cx="37" cy="49" r="3" fill="#fff"/><circle cx="63" cy="49" r="3" fill="#fff"/>'
        : '<circle cx="37" cy="50" r="4.6" fill="' + M + '"/><circle cx="63" cy="50" r="4.6" fill="' + M + '"/><circle cx="38.4" cy="48.4" r="1.5" fill="#fff"/><circle cx="64.4" cy="48.4" r="1.5" fill="#fff"/>');
    var burun = h.gaga ? '<path d="M43 60 L57 60 L50 70 Z" fill="#FF8A3D" stroke="' + M + '" stroke-width="2.6" stroke-linejoin="round"/>'
      : (h.k === 'goz' ? '<path d="M36 62 q14 12 28 0" fill="none" stroke="' + M + '" stroke-width="3" stroke-linecap="round"/>'
        : '<ellipse cx="50" cy="66" rx="14" ry="10" fill="' + h.b + '"/><ellipse cx="50" cy="61" rx="4.6" ry="3.4" fill="' + M + '"/><path d="M50 64 v4 M50 68 q-5 5 -9 1 M50 68 q5 5 9 1" fill="none" stroke="' + M + '" stroke-width="2.4" stroke-linecap="round"/>');
    return svg('0 0 100 100', kulak + '<circle cx="50" cy="54" r="34" fill="' + h.r + '" stroke="' + M + '" stroke-width="3"/>' +
      (h.k === 'goz' ? '' : '<ellipse cx="27" cy="62" rx="5" ry="3.4" fill="#FF9E8A" opacity=".8"/><ellipse cx="73" cy="62" rx="5" ry="3.4" fill="#FF9E8A" opacity=".8"/>') + goz + burun, 'kc-av');
  }

  /* ---------- resimli şifre / çıkartma simgeleri ---------- */
  var S = 'stroke="' + M + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
  var SIMGE = {
    elma: '<path d="M50 34 c-22 -14 -38 6 -30 30 c6 18 20 24 30 16 c10 8 24 2 30 -16 c8 -24 -8 -44 -30 -30 z" fill="#E5484D" ' + S + '/><path d="M50 34 q0 -12 8 -18" fill="none" ' + S + '/><path d="M58 20 q12 -8 20 2 q-12 8 -20 -2 z" fill="#4CC38A" ' + S + '/><path d="M32 50 q2 -10 10 -12" fill="none" stroke="#FFB4B6" stroke-width="4" stroke-linecap="round"/>',
    top: '<circle cx="50" cy="52" r="34" fill="#4AA8FF" ' + S + '/><path d="M20 38 q30 16 60 0 M18 60 q32 -14 64 0" fill="none" stroke="#FFD23F" stroke-width="7" stroke-linecap="round"/><circle cx="50" cy="52" r="34" fill="none" ' + S + '/>',
    balik: '<path d="M16 52 q26 -30 56 0 q-30 30 -56 0 z" fill="#FF8A3D" ' + S + '/><path d="M70 52 l18 -16 v32 z" fill="#FF8A3D" ' + S + '/><circle cx="32" cy="48" r="4" fill="' + M + '"/><path d="M46 38 q8 14 0 28" fill="none" stroke="#FFD23F" stroke-width="5" stroke-linecap="round"/>',
    cicek: '<path d="M50 60 v30" ' + S + ' fill="none"/><path d="M50 78 q-14 -10 -20 2 q12 8 20 -2 z" fill="#4CC38A" ' + S + '/><g fill="#FF7AA8" ' + S + '><circle cx="50" cy="22" r="12"/><circle cx="70" cy="36" r="12"/><circle cx="62" cy="58" r="12"/><circle cx="38" cy="58" r="12"/><circle cx="30" cy="36" r="12"/></g><circle cx="50" cy="42" r="10" fill="#FFD23F" ' + S + '/>',
    ay: '<path d="M62 14 a38 38 0 1 0 22 62 a30 30 0 0 1 -22 -62 z" fill="#FFD23F" ' + S + '/><circle cx="40" cy="48" r="3.4" fill="' + M + '"/><path d="M40 62 q8 6 14 0" fill="none" ' + S + '/>',
    araba: '<path d="M10 62 v-12 q0 -6 8 -6 h10 l10 -16 h28 l12 16 h6 q8 0 8 8 v10 z" fill="#E5484D" ' + S + '/><path d="M36 44 l6 -10 h10 v10 z M58 34 h6 l8 10 h-14 z" fill="#CDEBFF" ' + S + '/><circle cx="30" cy="66" r="10" fill="#fff" ' + S + '/><circle cx="72" cy="66" r="10" fill="#fff" ' + S + '/><circle cx="30" cy="66" r="3" fill="' + M + '"/><circle cx="72" cy="66" r="3" fill="' + M + '"/>',
    kus: '<ellipse cx="48" cy="54" rx="28" ry="24" fill="#4AA8FF" ' + S + '/><path d="M74 48 l16 4 l-16 6 z" fill="#FFD23F" ' + S + '/><circle cx="62" cy="46" r="4" fill="' + M + '"/><path d="M30 52 q14 -14 26 4 q-14 10 -26 -4 z" fill="#2F7FD6" ' + S + '/><path d="M42 78 v10 M54 78 v10" ' + S + ' fill="none"/>',
    cilek: '<path d="M50 90 q-34 -18 -30 -48 q30 -14 60 0 q4 30 -30 48 z" fill="#E5484D" ' + S + '/><path d="M26 40 q10 -14 24 -6 q14 -8 24 6 q-12 8 -24 2 q-12 6 -24 -2 z" fill="#4CC38A" ' + S + '/><g fill="#FFD23F"><circle cx="38" cy="56" r="2.4"/><circle cx="52" cy="54" r="2.4"/><circle cx="64" cy="58" r="2.4"/><circle cx="44" cy="70" r="2.4"/><circle cx="58" cy="70" r="2.4"/></g>',
    kedi: '<path d="M20 44 L24 14 L44 30 Z M80 44 L76 14 L56 30 Z" fill="#8E7CF0" ' + S + '/><circle cx="50" cy="56" r="32" fill="#8E7CF0" ' + S + '/><circle cx="38" cy="52" r="4.4" fill="' + M + '"/><circle cx="62" cy="52" r="4.4" fill="' + M + '"/><path d="M46 62 h8 l-4 5 z" fill="#FF9E8A" stroke="' + M + '" stroke-width="2"/><path d="M50 67 q-5 6 -10 2 M50 67 q5 6 10 2 M22 60 h12 M66 60 h12" fill="none" stroke="' + M + '" stroke-width="2.4" stroke-linecap="round"/>',
    yildiz: '<polygon points="' + yildizNokta(50, 52, 36, 17) + '" fill="#FFD23F" stroke="' + M + '" stroke-width="3" stroke-linejoin="round"/>',
    gokkusagi: '<g fill="none" stroke-width="8" stroke-linecap="round"><path d="M12 78 a38 38 0 0 1 76 0" stroke="#E5484D"/><path d="M21 78 a29 29 0 0 1 58 0" stroke="#FFD23F"/><path d="M30 78 a20 20 0 0 1 40 0" stroke="#4CC38A"/><path d="M39 78 a11 11 0 0 1 22 0" stroke="#4AA8FF"/></g><path d="M8 78 a42 42 0 0 1 84 0" fill="none" ' + S + '/>',
    firca: '<path d="M60 14 l22 22 l-34 34 l-22 -22 z" fill="#FFB347" ' + S + '/><path d="M26 48 l22 22 q-4 18 -30 16 q-4 -24 8 -38 z" fill="#E5484D" ' + S + '/>',
    kilit: '<rect x="24" y="44" width="52" height="40" rx="10" fill="#C9D3E6" ' + S + '/><path d="M34 44 v-10 a16 16 0 0 1 32 0 v10" fill="none" ' + S + '/><circle cx="50" cy="62" r="5" fill="' + M + '"/>',
    ses: '<path d="M16 40 h14 l20 -16 v52 l-20 -16 h-14 z" fill="#FFD23F" ' + S + '/><path d="M62 36 q10 14 0 28 M72 26 q18 24 0 48" fill="none" ' + S + '/>',
    mikrofon: '<rect x="36" y="12" width="28" height="46" rx="14" fill="#E5484D" ' + S + '/><path d="M24 46 a26 26 0 0 0 52 0 M50 72 v14 M36 88 h28" fill="none" ' + S + '/>',
    oynat: '<path d="M32 20 L78 50 L32 80 Z" fill="#fff" ' + S + '/>',
    ev: '<path d="M14 50 L50 18 L86 50" fill="none" ' + S + '/><path d="M24 46 v38 h52 v-38" fill="#fff" ' + S + '/><rect x="42" y="58" width="16" height="26" rx="3" fill="#FFB347" ' + S + '/>',
    album: '<rect x="18" y="16" width="64" height="70" rx="8" fill="#8E7CF0" ' + S + '/><rect x="28" y="16" width="6" height="70" fill="#6C59D8"/><polygon points="' + yildizNokta(58, 50, 16, 8) + '" fill="#FFD23F" stroke="' + M + '" stroke-width="2.6" stroke-linejoin="round"/>',
    tik: '<path d="M18 54 l20 20 l44 -48" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>',
    geri: '<path d="M60 18 L28 50 L60 82" fill="none" stroke="' + M + '" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>'
  };
  function simge(ad, cls) { return svg('0 0 100 100', SIMGE[ad] || SIMGE.yildiz, 'kc-simge ' + (cls || '')); }

  /* ---------- sahne parçaları ---------- */
  function bulut(cls) { return svg('0 0 200 90', '<path d="M30 76 q-24 0 -24 -20 q0 -18 22 -20 q4 -24 32 -24 q20 0 28 16 q10 -8 26 -4 q20 4 20 22 q22 0 22 16 q0 14 -18 14 z" fill="#fff" stroke="' + M + '" stroke-width="3" stroke-linejoin="round"/>', 'kc-bulut ' + (cls || '')); }
  function ada(renk, ic, kilitli) {
    return svg('0 0 200 170',
      '<path d="M22 86 q78 -34 156 0 q-6 44 -40 62 q-38 20 -76 0 q-34 -18 -40 -62 z" fill="#B98A5A" stroke="' + M + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M56 122 q10 10 22 6 M110 136 q12 4 22 -6" fill="none" stroke="#8F6740" stroke-width="3" stroke-linecap="round"/>' +
      '<ellipse cx="100" cy="84" rx="82" ry="26" fill="' + (kilitli ? '#D5DDEA' : renk) + '" stroke="' + M + '" stroke-width="3"/>' +
      '<path d="M40 80 q20 -10 44 -8" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".55"/>' +
      '<g transform="translate(62 2) scale(.76)"' + (kilitli ? ' opacity=".5"' : '') + '>' + (SIMGE[ic] || '') + '</g>', 'kc-ada');
  }
  function balon(renk) {
    return svg('0 0 100 150', '<path d="M50 104 q-6 22 4 42" fill="none" stroke="' + M + '" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M50 6 c26 0 42 20 42 46 c0 28 -22 52 -42 52 c-20 0 -42 -24 -42 -52 c0 -26 16 -46 42 -46 z" fill="' + renk + '" stroke="' + M + '" stroke-width="3"/>' +
      '<path d="M44 102 h12 l4 9 h-20 z" fill="' + renk + '" stroke="' + M + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M24 40 q4 -18 20 -22" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".7"/>', 'kc-balon');
  }
  function leke(renk) {
    return svg('0 0 100 100', '<path d="M50 8 c14 -4 22 8 32 12 c12 6 14 20 8 30 c-4 8 4 16 -2 26 c-8 12 -22 8 -32 14 c-12 6 -26 2 -32 -10 c-4 -10 -16 -12 -14 -26 c2 -12 10 -14 12 -24 c4 -14 14 -18 28 -22 z" fill="' + renk + '" stroke="' + M + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M30 32 q8 -12 20 -12" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".6"/>', 'kc-leke');
  }
  /* boyama resmi: güneş, ağaç, elma, top. data-parca ile boyanır */
  function boyamaResmi() {
    var B = 'fill="#fff" stroke="' + M + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
    return '<svg class="kc kc-boyama" viewBox="0 0 400 300" role="img" aria-label="Boyama resmi">' +
      '<path d="M0 232 q100 -30 200 -6 q100 24 200 -8 v82 h-400 z" fill="#EAF7E3" stroke="' + M + '" stroke-width="3"/>' +
      '<g data-parca="sun" tabindex="0" role="button" aria-label="sun"><g stroke="' + M + '" stroke-width="3" stroke-linecap="round"><path d="M70 14 v14 M70 112 v14 M14 70 h14 M112 70 h14 M30 30 l10 10 M100 100 l10 10 M110 30 l-10 10 M40 100 l-10 10"/></g><circle cx="70" cy="70" r="32" ' + B + '/></g>' +
      '<rect x="262" y="150" width="26" height="90" rx="6" fill="#B98A5A" stroke="' + M + '" stroke-width="3"/>' +
      '<g data-parca="tree" tabindex="0" role="button" aria-label="tree"><path d="M275 30 c40 0 66 26 66 60 c0 34 -28 62 -66 62 c-38 0 -66 -28 -66 -62 c0 -34 26 -60 66 -60 z" ' + B + '/></g>' +
      '<g data-parca="apple" tabindex="0" role="button" aria-label="apple"><path d="M140 196 c-20 -12 -36 6 -28 28 c6 16 18 22 28 14 c10 8 22 2 28 -14 c8 -22 -8 -40 -28 -28 z" ' + B + '/><path d="M140 196 q0 -10 8 -16" fill="none" stroke="' + M + '" stroke-width="3" stroke-linecap="round"/></g>' +
      '<g data-parca="ball" tabindex="0" role="button" aria-label="ball"><circle cx="350" cy="236" r="30" ' + B + '/><path d="M324 224 q26 14 52 0 M322 246 q28 -12 56 0" fill="none" stroke="' + M + '" stroke-width="3" stroke-linecap="round"/></g></svg>';
  }

  W.KIDS_CIZ = { acadia: acadia, avatar: avatar, simge: simge, bulut: bulut, ada: ada, balon: balon, leke: leke, boyamaResmi: boyamaResmi, HAYVAN: Object.keys(HAYVAN), SIMGE: Object.keys(SIMGE), MUREKKEP: M };
})(window);
