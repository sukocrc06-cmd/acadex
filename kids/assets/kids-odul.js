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
    var l = (bant && bant.paket != null ? P.ogeler(bant) : K.hepsi(kid)).map(function (o) { return { o: o, u: Math.min(3, (il.usta || {})[o.id] || 0) }; });
    return { n: l.reduce(function (t, x) { return t + x.u; }, 0), max: 3 * l.length, ogren: l.filter(function (x) { return x.u >= 3; }).length, liste: l };
  }
  function ustaToplam(il) { return Object.keys(il.usta || {}).reduce(function (t, k) { return t + Math.min(3, il.usta[k]); }, 0); }
  /* kelime paketleri: bitirilen paketler il.paketler[konu][k] */
  function paketBitti(il, kid, k) { return !!((il.paketler || {})[kid] || {})[k]; }
  function paketAcik(il, kid, k) { return k === 0 || paketBitti(il, kid, k - 1); }
  function biteniPaket(il, kid) { return Object.keys((il.paketler || {})[kid] || {}).length; }
  function asama(il, kid) { var s = seviye(il, kid); if (s >= 3) return 3; if (s >= 1) return 2; return konuYildiz(il, kid) || Object.keys(il.usta || {}).some(function (id) { return V.ogeKonu(id) === kid; }) ? 1 : 0; }

  /* ---------- madalya çizimi ---------- */
  function madalya(L, kilitli, boy) {
    var m = MADALYA[L - 1], f = kilitli ? '#E3E8F2' : m.renk, f2 = kilitli ? '#F3F5F9' : m.acik;
    return '<svg class="kc kc-madalya' + (kilitli ? ' kc-kilitli' : '') + '" viewBox="0 0 60 70" width="' + (boy || 24) + '" aria-hidden="true" focusable="false"><path d="M18 2 h10 l6 26 h-10 z" fill="' + (kilitli ? '#C7CCD6' : '#E5484D') + '" stroke="' + M + '" stroke-width="2.6" stroke-linejoin="round"/><path d="M42 2 h-10 l-6 26 h10 z" fill="' + (kilitli ? '#C7CCD6' : '#4AA8FF') + '" stroke="' + M + '" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<circle cx="30" cy="44" r="22" fill="' + f + '" stroke="' + M + '" stroke-width="3"/><circle cx="30" cy="44" r="14" fill="' + f2 + '" stroke="' + M + '" stroke-width="2"/>' +
      '<text x="30" y="50" text-anchor="middle" font-family="\'Baloo 2\',sans-serif" font-weight="800" font-size="17" fill="' + M + '">' + (kilitli ? '?' : L) + '</text></svg>';
  }

  /* ---------- parlak metal madalya (konu penceresindeki kürsü, 21.11.2026) ----------
     durum: 'bitti' (kazanıldı) · 'sira' (oynanabilir, henüz kazanılmadı) · 'kilit'.
     Metal dört tonlu degrade + iç kabartma yıldız + üstünden süzülen ışık şeridi (CSS: .kc-md-isik). */
  var METAL = [['#FFD9AE', '#E59B5C', '#B8682F', '#7A3F17'], ['#FFFFFF', '#DCE3EC', '#A3AFC2', '#6E7A8F'], ['#FFF6B8', '#FFD23F', '#E8A300', '#9C6500']];
  var mdN = 0;
  function madalyaParlak(L, durum) {
    var n = ++mdN, g = 'kmd' + n, gi = 'kmi' + n, cl = 'kmc' + n, kilit = durum === 'kilit';
    var t = kilit ? ['#F1F3F8', '#D3D9E5', '#B1B9CA', '#7D879C'] : METAL[L - 1];
    var kurdele = kilit ? ['#C3CAD8', '#AEB6C7'] : [['#FF8A5B', '#E5484D'], ['#7FC4FF', '#3A86E0'], ['#FF6B8B', '#8E5CF6']][L - 1];
    var yildiz = 'M50 52 l5.3 10.8 11.9 1.7 -8.6 8.4 2 11.8 -10.6 -5.6 -10.6 5.6 2 -11.8 -8.6 -8.4 11.9 -1.7 z';
    return '<svg class="kc kc-mdp kc-mdp-' + (kilit ? 'kilit' : durum) + '" viewBox="0 0 100 124" aria-hidden="true" focusable="false">' +
      '<defs><linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + t[0] + '"/><stop offset=".35" stop-color="' + t[1] + '"/><stop offset=".7" stop-color="' + t[2] + '"/><stop offset="1" stop-color="' + t[3] + '"/></linearGradient>' +
      '<linearGradient id="' + gi + '" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + t[0] + '"/><stop offset=".55" stop-color="' + t[1] + '"/><stop offset="1" stop-color="' + t[2] + '"/></linearGradient>' +
      '<clipPath id="' + cl + '"><circle cx="50" cy="72" r="36"/></clipPath></defs>' +
      '<path d="M30 4 h16 l10 40 h-16 z" fill="' + kurdele[0] + '" stroke="' + M + '" stroke-width="3" stroke-linejoin="round"/><path d="M70 4 h-16 l-10 40 h16 z" fill="' + kurdele[1] + '" stroke="' + M + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M36 10 l6 24" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".45"/>' +
      '<circle cx="50" cy="72" r="36" fill="url(#' + g + ')" stroke="' + M + '" stroke-width="3.4"/>' +
      '<circle cx="50" cy="72" r="27" fill="url(#' + gi + ')" stroke="' + t[3] + '" stroke-width="2.2" opacity=".95"/>' +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (i) { var a = i * Math.PI / 6, x = 50 + Math.cos(a) * 31.5, y = 72 + Math.sin(a) * 31.5; return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="1.5" fill="' + t[0] + '" opacity=".85"/>'; }).join('') +
      (kilit ? '<g transform="translate(50 74)"><rect x="-11" y="-4" width="22" height="17" rx="4" fill="#8A94AB" stroke="' + M + '" stroke-width="2.6"/><path d="M-6.5 -4 v-5 a6.5 6.5 0 0 1 13 0 v5" fill="none" stroke="' + M + '" stroke-width="2.8"/><circle cx="0" cy="4" r="2.4" fill="' + M + '"/></g>'
        : '<path d="' + yildiz + '" transform="translate(0 1.5)" fill="' + t[3] + '" opacity=".45"/><path d="' + yildiz + '" fill="' + t[0] + '" stroke="' + t[3] + '" stroke-width="2" stroke-linejoin="round"/>' +
          '<text x="50" y="106" text-anchor="middle" font-family="\'Baloo 2\',sans-serif" font-weight="800" font-size="11" fill="' + t[3] + '" opacity=".9">' + L + '</text>') +
      '<path d="M26 58 a28 28 0 0 1 22 -20" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>' +
      (kilit ? '' : '<g clip-path="url(#' + cl + ')"><g transform="rotate(24 50 72)"><rect class="kc-md-isik" x="-10" y="10" width="14" height="130" fill="#fff" opacity=".6"/></g></g>') +
      '</svg>';
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
    ustalik: ustalik, ustaToplam: ustaToplam, paketBitti: paketBitti, paketAcik: paketAcik, biteniPaket: biteniPaket, asama: asama, madalya: madalya, madalyaParlak: madalyaParlak, adaEk: adaEk, SAKIN: SAKIN, YAPI: YAPI };
})(window);
