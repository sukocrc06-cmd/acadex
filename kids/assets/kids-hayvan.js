/* ==========================================================================
   ACADEX KIDS · tam gövdeli, canlı hayvanlar (kids/assets/kids-hayvan.js), 13.11.2026
   İlk hayvan çizimleri yalnız yüzdü (kedi, köpek, tavşan, aslan…). Burada aynı yüz korunur,
   altına gövde, göbek, patiler ve kuyruk eklenir; böylece küçük kutucuklarda yüz, büyük
   sahnelerde (İzle, Dokun, Sahne kur, kitaplar, Evcil hayvanım) tam gövde görünür.
   Canlılık: kuyruk sallanır, kafa hafifçe oynar, gövde nefes alır; konuşurken ağız açılır
   (.kc-konusuyor ya da üst öğede .kn-oge-konus / .ka-konusuyor sınıfı).
   W.KIDS_HAYVAN.var(id) · ciz(id, cls) · en(o) (varsa tam gövde, yoksa olağan çizim)
   ========================================================================== */
(function (W) {
  'use strict';
  var R = W.KIDS_RESIM, M = '#23304D';
  /* g: gövde rengi, k: göbek, a: ayak/pati, t: kuyruk türü, tr: kuyruk rengi, ag: ağız yeri [x, y] (yüz çiziminin 100'lük ızgarasında) */
  var T = {
    cat: { g: '#FF9F45', k: '#FFE1C4', t: 'uzun', ag: [50, 60] },
    dog: { g: '#E8C48A', k: '#FFF1DC', a: '#B07A40', t: 'gur', tr: '#B07A40', ag: [50, 64] },
    rabbit: { g: '#F6F1EA', k: '#FFFFFF', a: '#FFC2D4', t: 'ponpon', ag: [50, 62] },
    frog: { g: '#5DCB7B', k: '#C9F2D2', t: 'yok', kurbaga: 1, ag: [50, 60] },
    cow: { g: '#FFFFFF', k: '#FFD9E0', a: '#23304D', t: 'puskul', leke: '#23304D', ag: [50, 70] },
    chick: { g: '#FFD84A', k: '#FFE98A', a: '#FF8A1F', t: 'yok', kus: 1, ag: null },
    lion: { g: '#F2B84B', k: '#FFE2A8', t: 'puskul', tr: '#B5651D', ag: [50, 66] },
    bear: { g: '#C68A4B', k: '#F3D7B5', t: 'ponpon', ag: [50, 66] },
    horse: { g: '#C68A4B', k: '#E8C9A0', a: '#5A3A22', t: 'gur', tr: '#5A3A22', ag: [50, 74] },
    pig: { g: '#FFB1C8', k: '#FFD3E0', a: '#F06A95', t: 'kivrik', ag: null },
    sheep: { g: '#FFFFFF', k: '#F3F4F8', a: '#5A3A22', t: 'ponpon', yun: 1, ag: [50, 62] },
    monkey: { g: '#8F5F3C', k: '#FFD9B8', t: 'uzun', ag: [50, 66] },
    elephant: { g: '#AEB6CC', k: '#D5DAE8', t: 'puskul', ag: null },
    tiger: { g: '#FF9F45', k: '#FFF1DC', t: 'uzun', serit: 1, ag: [50, 66] },
    mouse: { g: '#C5CAD8', k: '#EEF0F6', a: '#FFB1C8', t: 'ince', tr: '#FFB1C8', ag: null },
    zebra: { g: '#FFFFFF', k: '#F3F4F8', a: '#23304D', t: 'puskul', serit: 1, ag: null },
    panda: { g: '#FFFFFF', k: '#FFFFFF', a: '#23304D', t: 'ponpon', kol: '#23304D', ag: [50, 66] },
    fox: { g: '#F0703A', k: '#FFF1DC', a: '#5A3A22', t: 'gur', uc: '#FFFFFF', ag: [50, 66] },
    goat: { g: '#F6F4EE', k: '#FFFFFF', a: '#8A6A4A', t: 'ponpon', ag: null },
    hippo: { g: '#C9B8E8', k: '#E6DCF7', t: 'ince', ag: null }
  };
  function kuyruk(o) {
    var r = o.tr || o.g, ic;
    if (o.t === 'yok') return '';
    if (o.t === 'uzun') ic = '<path d="M66 86 q22 2 20 -18 q-1 -8 -8 -8" fill="none" stroke="' + M + '" stroke-width="10" stroke-linecap="round"/><path d="M66 86 q22 2 20 -18 q-1 -8 -8 -8" fill="none" stroke="' + r + '" stroke-width="5.5" stroke-linecap="round"/>';
    else if (o.t === 'ince') ic = '<path d="M68 88 q20 0 18 -14" fill="none" stroke="' + M + '" stroke-width="6" stroke-linecap="round"/><path d="M68 88 q20 0 18 -14" fill="none" stroke="' + r + '" stroke-width="2.6" stroke-linecap="round"/>';
    else if (o.t === 'puskul') ic = '<path d="M68 86 q16 0 16 -14" fill="none" stroke="' + M + '" stroke-width="7" stroke-linecap="round"/><path d="M68 86 q16 0 16 -14" fill="none" stroke="' + o.g + '" stroke-width="3" stroke-linecap="round"/><ellipse cx="84" cy="68" rx="5" ry="7" fill="' + (o.tr || M) + '" stroke="' + M + '" stroke-width="2.6"/>';
    else if (o.t === 'ponpon') ic = '<circle cx="73" cy="84" r="7" fill="' + (o.tr || o.k) + '" stroke="' + M + '" stroke-width="3"/>';
    else if (o.t === 'kivrik') ic = '<path d="M70 82 q10 -2 8 -8 q-2 -5 -6 -1 q-2 4 4 5" fill="none" stroke="' + M + '" stroke-width="6" stroke-linecap="round"/><path d="M70 82 q10 -2 8 -8 q-2 -5 -6 -1 q-2 4 4 5" fill="none" stroke="' + (o.a || r) + '" stroke-width="2.6" stroke-linecap="round"/>';
    else ic = '<path d="M66 88 q26 4 24 -20 q-1 -10 -10 -6 q-8 6 -14 26z" fill="' + r + '" stroke="' + M + '" stroke-width="3" stroke-linejoin="round"/>' + (o.uc ? '<path d="M88 64 q-2 -6 -7 -2 q-3 3 -4 8 q8 0 11 -6z" fill="' + o.uc + '"/>' : '');
    return '<g class="kc-kuyruk">' + ic + '</g>';
  }
  function govde(o) {
    var a = o.a || o.g, s = '';
    if (o.kus) return '<g class="kc-govde"><ellipse cx="50" cy="76" rx="19" ry="16" fill="' + o.g + '" stroke="' + M + '" stroke-width="3.2"/><path d="M32 72 q-10 4 -4 14 q6 -2 8 -8z M68 72 q10 4 4 14 q-6 -2 -8 -8z" fill="' + o.k + '" stroke="' + M + '" stroke-width="2.8" stroke-linejoin="round"/></g>' +
      '<path d="M42 92 l-5 5 M42 92 l0 6 M42 92 l5 5 M58 92 l-5 5 M58 92 l0 6 M58 92 l5 5" stroke="' + a + '" stroke-width="2.8" stroke-linecap="round"/>';
    s += '<g class="kc-govde"><ellipse cx="50" cy="74" rx="22" ry="20" fill="' + o.g + '" stroke="' + M + '" stroke-width="3.2"/>';
    if (o.yun) s += '<path d="M30 70 q-5 -6 2 -9 q2 -7 9 -4 q5 -5 10 0 q6 -4 10 1 q7 -1 7 6 q6 4 1 9" fill="' + o.g + '" stroke="' + M + '" stroke-width="2.6" stroke-linejoin="round"/>';
    if (o.leke) s += '<path d="M33 68 q6 -6 10 2 q-2 8 -9 5z M60 84 q6 -4 9 2 q-3 6 -9 3z" fill="' + o.leke + '"/>';
    if (o.serit) s += '<path d="M30 70 l7 2 M29 78 l7 0 M70 70 l-7 2 M71 78 l-7 0" stroke="' + M + '" stroke-width="2.8" stroke-linecap="round"/>';
    s += '<ellipse cx="50" cy="78" rx="12" ry="13" fill="' + o.k + '"/></g>';
    /* arka ayaklar */
    if (o.kurbaga) s += '<path d="M30 80 q-14 2 -12 12 h16 q4 -6 -4 -12z M70 80 q14 2 12 12 h-16 q-4 -6 4 -12z" fill="' + o.g + '" stroke="' + M + '" stroke-width="3" stroke-linejoin="round"/>';
    else s += '<ellipse cx="33" cy="92" rx="9" ry="5" fill="' + a + '" stroke="' + M + '" stroke-width="3"/><ellipse cx="67" cy="92" rx="9" ry="5" fill="' + a + '" stroke="' + M + '" stroke-width="3"/>';
    /* ön patiler */
    var kol = o.kol || o.g;
    s += '<path d="M40 66 q-5 0 -5 6 v13 q0 5 5 5 q5 0 5 -5 v-13 q0 -6 -5 -6z M60 66 q-5 0 -5 6 v13 q0 5 5 5 q5 0 5 -5 v-13 q0 -6 -5 -6z" fill="' + kol + '" stroke="' + M + '" stroke-width="3" stroke-linejoin="round"/>';
    if (a !== o.g && !o.kol) s += '<path d="M36 84 h8 M56 84 h8" stroke="' + a + '" stroke-width="4" stroke-linecap="round"/>';
    return s;
  }
  function icTam(id) {
    var o = T[id];
    var agiz = o.ag ? '<g class="kc-konus-agiz"><ellipse cx="' + o.ag[0] + '" cy="' + (o.ag[1] + 2) + '" rx="6" ry="5.5" fill="#7A2E3A" stroke="' + M + '" stroke-width="2.4"/><ellipse cx="' + o.ag[0] + '" cy="' + (o.ag[1] + 5) + '" rx="3.4" ry="2.2" fill="#FF8FA3"/></g>' : '';
    return kuyruk(o) + govde(o) + '<g class="kc-kafa"><g transform="translate(16 -5) scale(.68)">' + R.ic(id) + agiz + '</g></g>';
  }
  function varMi(id) { return !!T[id] && !!R.ic(id); }
  function ciz(id, cls) { return '<svg class="kc kc-resim kc-hayvan ' + (cls || '') + '" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' + icTam(id) + '</svg>'; }
  /* bir kelimenin büyük görseli: tam gövdesi varsa o, yoksa paketin olağan görseli */
  function en(o, P) { return o && varMi(o.id) ? ciz(o.id) : (P ? P.gorsel(o) : R.ciz(o.id)); }
  W.KIDS_HAYVAN = { var: varMi, ciz: ciz, ic: icTam, en: en, T: T };
})(window);
