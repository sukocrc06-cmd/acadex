/* ==========================================================================
   ACADEX KIDS · ilerleme ve ada dünyası (kids/assets/kids-odul.js), 12.11.2026
   1) Bronz · Gümüş · Altın: her konu üç kez bitirilir. Gümüş ve Altın'da daha çok
      kelime, daha çok seçenek ve tur var (bantSeviye). Yıldızlar seviye başına ayrı
      tutulur: il.yildiz[konu] (bronz), il.yildiz['konu@2'] (gümüş), ['konu@3'] (altın).
   2) Kelime ustalığı: her kelimenin 0-3 ustalık yıldızı (il.usta[kelime]). Bir oyun
      durağında doğru bilinen kelime +1 alır (durak başına bir kez); üç ayrı oyunda
      bilinen kelime "öğrenildi" sayılır. Yanlışta düşmez.
   3) Büyüyen ada: 0 boş · 1 oynandı (çimen, çiçek) · 2 bronz (konunun yapıları) ·
      3 altın (altın kule, ışık halkası). Her adada konuya özel canlı sakinler.
   Hesaplar saf fonksiyon; çizim KIDS_RESIM'le. W.KIDS_ODUL
   ========================================================================== */
(function (W) {
  'use strict';
  var V = W.KIDS_VERI, K = W.KIDS_KONU, R = W.KIDS_RESIM, C = W.KIDS_CIZ, M = '#23304D';
  var MADALYA = [{ id: 1, ad: 'Bronz', en: 'Bronze', renk: '#D9894A', acik: '#F2B784' }, { id: 2, ad: 'Gümüş', en: 'Silver', renk: '#AEB8C8', acik: '#E3E8F2' }, { id: 3, ad: 'Altın', en: 'Gold', renk: '#F2B300', acik: '#FFE27A' }];

  function anahtar(kid, L) { return L > 1 ? kid + '@' + L : kid; }
  function topla(y) { return Object.keys(y || {}).reduce(function (t, o) { return t + y[o]; }, 0); }
  function seviyeYildiz(il, kid, L) { return topla((il.yildiz || {})[anahtar(kid, L)]); }
  function konuYildiz(il, kid) { return seviyeYildiz(il, kid, 1) + seviyeYildiz(il, kid, 2) + seviyeYildiz(il, kid, 3); }
  function konuMax(kid) { return 3 * K.yildizMax(kid); }
  function seviye(il, kid) { return Math.max((il.seviye || {})[kid] || 0, (il.bitti || {})[kid] ? 1 : 0); }
  /* seviyeye göre zorluk: daha çok kelime, seçenek, tur, kart */
  function bantSeviye(b, L) {
    if (!L || L <= 1) return b;
    var x = {}; for (var k in b) x[k] = b[k]; var a = L - 1;
    x.secenek = Math.min(b.secenek + a, 6); x.tur = b.tur + 2 * a; x.cift = Math.min(b.cift + a, 8);
    x.kelimeSay = Math.min((b.kelimeSay || 8) + 2 * a, 20); x.renkSay = Math.min((b.renkSay || 6) + 2 * a, 11); x.sayiSay = Math.min((b.sayiSay || 10) + 5 * a, 20);
    if (L === 3 && b.yazi) x.kelimeKart = true;
    x.seviye = L; return x;
  }
  function ustalik(il, kid, bant) {
    var P = K.al(kid); if (!P) return { n: 0, max: 0, ogren: 0, liste: [] };
    var l = P.ogeler(bant).map(function (o) { return { o: o, u: Math.min(3, (il.usta || {})[o.id] || 0) }; });
    return { n: l.reduce(function (t, x) { return t + x.u; }, 0), max: 3 * l.length, ogren: l.filter(function (x) { return x.u >= 3; }).length, liste: l };
  }
  function ustaToplam(il) { return Object.keys(il.usta || {}).reduce(function (t, k) { return t + Math.min(3, il.usta[k]); }, 0); }
  function asama(il, kid) { var s = seviye(il, kid); if (s >= 3) return 3; if (s >= 1) return 2; return konuYildiz(il, kid) || Object.keys(il.usta || {}).some(function (id) { return V.ogeKonu(id) === kid; }) ? 1 : 0; }

  /* ---------- madalya çizimi ---------- */
  function madalya(L, kilitli, boy) {
    var m = MADALYA[L - 1], f = kilitli ? '#E3E8F2' : m.renk, f2 = kilitli ? '#F3F5F9' : m.acik;
    return '<svg class="kc kc-madalya' + (kilitli ? ' kc-kilitli' : '') + '" viewBox="0 0 60 70" width="' + (boy || 24) + '" aria-hidden="true" focusable="false"><path d="M18 2 h10 l6 26 h-10 z" fill="' + (kilitli ? '#C7CCD6' : '#E5484D') + '" stroke="' + M + '" stroke-width="2.6" stroke-linejoin="round"/><path d="M42 2 h-10 l-6 26 h10 z" fill="' + (kilitli ? '#C7CCD6' : '#4AA8FF') + '" stroke="' + M + '" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<circle cx="30" cy="44" r="22" fill="' + f + '" stroke="' + M + '" stroke-width="3"/><circle cx="30" cy="44" r="14" fill="' + f2 + '" stroke="' + M + '" stroke-width="2"/>' +
      '<text x="30" y="50" text-anchor="middle" font-family="\'Baloo 2\',sans-serif" font-weight="800" font-size="17" fill="' + M + '">' + (kilitli ? '?' : L) + '</text></svg>';
  }

  /* ---------- büyüyen ada ve sakinler (ada çiziminin 200x170 düzlemi) ---------- */
  var SAKIN = {
    colours: [['firca', 'zipla'], ['gokkusagi', 'uc']], numbers: [['top', 'zipla'], ['yildiz', 'don']], animals: [['chick', 'yuru'], ['duck', 'yuru']], family: [['pet', 'yuru'], ['kus', 'uc']],
    body: [['run', 'yuru'], ['jump', 'zipla']], food: [['apple', 'zipla'], ['cherries', 'zipla']], toys: [['ball', 'zipla'], ['kite', 'uc']], clothes: [['socks', 'salla'], ['hat', 'zipla']],
    home: [['cat', 'yuru'], ['lamp', 'salla']], school: [['pencil', 'salla'], ['book', 'zipla']], weather: [['snow', 'yag'], ['cloud', 'uc']], feelings: [['happy', 'zipla'], ['loved', 'salla']],
    fruits: [['cherries', 'zipla'], ['kus', 'uc']], transport: [['car', 'yuru'], ['plane', 'uc']], shapes: [['star', 'don'], ['heart', 'zipla']], sea: [['dolphin', 'zipla'], ['kabarcik', 'kabarcik']],
    jobs: [['firefighter', 'yuru'], ['helicopter', 'uc']], actions: [['dance', 'salla'], ['jump', 'zipla']], seasons: [['yaprak', 'yag'], ['kus', 'uc']], days: [['kus', 'uc'], ['monday', 'salla']],
    places: [['ball', 'zipla'], ['cat', 'yuru']], alphabet: [['harf-b', 'don'], ['harf-c', 'zipla']]
  };
  var YAPI = {
    colours: ['paints', 'firca'], numbers: ['blocks', 'dice'], animals: ['sheep', 'pig'], family: ['family', 'plant'], body: ['hands', 'feet'], food: ['cake', 'pizza'], toys: ['teddy', 'train'],
    clothes: ['dress', 'boots'], home: ['sofa', 'plant'], school: ['bag', 'globe'], weather: ['umbrella', 'snowman'], feelings: ['excited', 'calm'], fruits: ['pineapple', 'watermelon'],
    transport: ['bus', 'bike'], shapes: ['triangle', 'circle'], sea: ['shell', 'starfish'], jobs: ['teacher', 'chef'], actions: ['swim', 'climb'], seasons: ['spring', 'winter'], days: ['friday', 'sunday'],
    places: ['under', 'in'], alphabet: ['harf-a', 'harf-z']
  };
  function icOf(ad) { return R.var(ad) ? R.ic(ad) : C.simge(ad).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''); }
  function yer(x, y, s, ic, cls) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><g class="' + (cls || '') + '">' + ic + '</g></g>'; }
  function sakin(ad, hareket, x, y, s, i) {
    if (hareket === 'kabarcik') return [0, 1, 2].map(function (j) { return '<circle class="kc-s-kabarcik" style="--j:' + j + '" cx="' + (x + j * 14) + '" cy="' + y + '" r="' + (3 + j) + '" fill="#E3F4FF" stroke="#4AA8FF" stroke-width="1.6"/>'; }).join('');
    if (hareket === 'yag') return [0, 1, 2, 3].map(function (j) { return yer(30 + j * 38 + (i * 9), 4, 0.13, icOf(ad), 'kc-sakin kc-s-yag" style="--j:' + j); }).join('');
    return yer(x, y, s, icOf(ad), 'kc-sakin kc-s-' + hareket + '" style="--j:' + i);
  }
  function cimen(x, y) { return '<path d="M' + x + ' ' + y + ' q-2 -8 -6 -10 M' + x + ' ' + y + ' q0 -10 2 -12 M' + x + ' ' + y + ' q3 -7 7 -8" fill="none" stroke="#3FB86A" stroke-width="2.6" stroke-linecap="round"/>'; }
  function cicek(x, y, f) { return '<path d="M' + x + ' ' + (y + 8) + ' v-8" stroke="#3FB86A" stroke-width="2"/><circle cx="' + x + '" cy="' + y + '" r="4" fill="' + f + '" stroke="' + M + '" stroke-width="1.6"/><circle cx="' + x + '" cy="' + y + '" r="1.4" fill="#FFF3B0"/>'; }
  function kule() {
    return '<g class="kc-kule"><rect x="150" y="24" width="24" height="44" fill="#FFD23F" stroke="' + M + '" stroke-width="2.6"/><path d="M148 24 v-8 h6 v5 h5 v-5 h6 v5 h5 v-5 h6 v8 z" fill="#FFD23F" stroke="' + M + '" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<path d="M158 68 v-12 q4 -6 8 0 v12" fill="#B07A40" stroke="' + M + '" stroke-width="2"/><path d="M162 8 v-14" stroke="' + M + '" stroke-width="2.4"/><path d="M162 -6 l14 4 l-14 4 z" fill="#E5484D" stroke="' + M + '" stroke-width="2" stroke-linejoin="round"/></g>';
  }
  function adaEk(kid, a) {
    var h = '', S2 = SAKIN[kid] || SAKIN.colours, Y = YAPI[kid] || YAPI.colours;
    if (a >= 3) h += '<ellipse class="kc-halka" cx="100" cy="84" rx="88" ry="30" fill="none" stroke="#FFD23F" stroke-width="5" stroke-dasharray="10 8"/>';
    if (a >= 1) h += cimen(34, 90) + cimen(168, 92) + cimen(58, 104) + cimen(144, 104) + cicek(46, 82, '#FF6FA5') + cicek(156, 80, '#FFD23F') + cicek(122, 104, '#8E7CF0');
    if (a >= 2) h += yer(18, 42, 0.3, icOf(Y[0]), 'kc-yapi') + (a >= 3 ? '' : yer(146, 44, 0.28, icOf(Y[1]), 'kc-yapi'));
    if (a >= 3) h += kule();
    h += sakin(S2[0][0], S2[0][1], 46, 62, 0.27, 0);
    if (a >= 2) h += sakin(S2[1][0], S2[1][1], 126, 64, 0.23, 1);
    return h;
  }

  W.KIDS_ODUL = { MADALYA: MADALYA, anahtar: anahtar, seviyeYildiz: seviyeYildiz, konuYildiz: konuYildiz, konuMax: konuMax, seviye: seviye, bantSeviye: bantSeviye,
    ustalik: ustalik, ustaToplam: ustaToplam, asama: asama, madalya: madalya, adaEk: adaEk, SAKIN: SAKIN, YAPI: YAPI };
})(window);
