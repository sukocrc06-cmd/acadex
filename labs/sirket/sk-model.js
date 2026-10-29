/* ==========================================================================
   ACADEX ŞİRKET · hesap çekirdeği (labs/sirket/sk-model.js), 29.10.2026
   DOM'suz saf fonksiyonlar (testler bunları çağırır): window.SKM
     - terazi: olay uygula, denge, gelir tablosu, nakit akışı
     - maliyet: katkı payı, başabaş, hedef kâr, faaliyet kaldıracı, bütçe sapmaları
     - yatırım: NBD, İVO, geri ödeme, karlılık endeksi, sermaye tayınlaması
     - organizasyon: kontrol alanı → kademe ve yönetici sayısı
     - simülasyon: bir çeyreği kapat (çift taraflı; aktif = pasif her çeyrek korunur)
   ========================================================================== */
(function () {
  'use strict';
  var M = {};

  /* ---------------- terazi ---------------- */
  M.apply = function (bal, ev) { var o = {}; Object.keys(bal).forEach(function (k) { o[k] = bal[k]; }); Object.keys(ev.fx).forEach(function (k) { o[k] = (o[k] || 0) + ev.fx[k]; }); return o; };
  M.side = function (bal, kalem, s) { return kalem.filter(function (k) { return k[2] === s; }).reduce(function (a, k) { return a + (bal[k[0]] || 0); }, 0); };
  M.balanced = function (bal, kalem) { return Math.abs(M.side(bal, kalem, 'A') - M.side(bal, kalem, 'P')) < 1e-9; };
  M.evBalanced = function (ev, kalem) {
    var s = { A: 0, P: 0 }; Object.keys(ev.fx).forEach(function (k) { var r = kalem.filter(function (x) { return x[0] === k; })[0]; s[r[2]] += ev.fx[k]; });
    return Math.abs(s.A - s.P) < 1e-9;
  };
  /* gelir tablosu: uygulanmış olaylardan */
  M.gelir = function (evs) {
    var g = { sat: 0, smm: 0, gid: [] };
    evs.forEach(function (e) { if (!e.gt) return; g.sat += e.gt.sat || 0; g.smm += e.gt.smm || 0; if (e.gt.gid) g.gid.push(e.gt.gid); });
    g.brut = g.sat - g.smm; g.gidT = g.gid.reduce(function (a, x) { return a + x[1]; }, 0); g.net = g.brut - g.gidT;
    return g;
  };
  /* nakit akışı (doğrudan yöntem): kasa değişimi türüne göre; "karma" = faiz işletmeye, anapara finansmana */
  M.nakit = function (evs) {
    var n = { isletme: 0, yatirim: 0, finansman: 0 };
    evs.forEach(function (e) {
      var c = e.fx.kasa || 0; if (!c) return;
      if (e.nk === 'karma') { n.finansman += e.fx.kredi || 0; n.isletme += c - (e.fx.kredi || 0); }
      else n[e.nk] += c;
    });
    n.net = n.isletme + n.yatirim + n.finansman;
    return n;
  };
  /* dolaylı yöntem köprüsü: net kâr + amortisman − alacak artışı − stok artışı + borç artışı */
  M.dolayli = function (bas, son, gel, amort) {
    return gel.net + amort - ((son.alacak || 0) - (bas.alacak || 0)) - ((son.stok || 0) - (bas.stok || 0)) + ((son.satici || 0) - (bas.satici || 0));
  };
  /* nakit dönüşüm süresi */
  M.ndd = function (stokG, alacakG, borcG) { return stokG + alacakG - borcG; };

  /* ---------------- maliyet ---------------- */
  M.kp = function (fiyat, deg) { return fiyat - deg; };
  M.bep = function (sabit, fiyat, deg) { return fiyat > deg ? sabit / (fiyat - deg) : Infinity; };
  M.hedefAdet = function (sabit, hedef, fiyat, deg) { return fiyat > deg ? (sabit + hedef) / (fiyat - deg) : Infinity; };
  M.kar = function (adet, sabit, fiyat, deg) { return adet * (fiyat - deg) - sabit; };
  M.fk = function (adet, sabit, fiyat, deg) { var k = M.kar(adet, sabit, fiyat, deg); return k ? adet * (fiyat - deg) / k : Infinity; };
  M.guvenlik = function (adet, sabit, fiyat, deg) { return adet > 0 ? (adet - M.bep(sabit, fiyat, deg)) / adet : 0; };
  /* sapmalar (+ lehte, − aleyhte) */
  M.sapma = function (B) {
    var b = B.b, g = B.g;
    var satFiyat = (g.fiyat - b.fiyat) * g.adet, satHacim = (g.adet - b.adet) * b.fiyat;
    var std = g.adet * b.kg; /* gerçek üretim için standart kg */
    var mFiyat = (b.kgFiyat - g.kgFiyat) * g.adet * g.kg, mMiktar = (std - g.adet * g.kg) * b.kgFiyat;
    return { satFiyat: satFiyat, satHacim: satHacim, mFiyat: mFiyat, mMiktar: mMiktar,
      gelirB: b.adet * b.fiyat, gelirG: g.adet * g.fiyat, malzB: b.adet * b.kg * b.kgFiyat, malzG: g.adet * g.kg * g.kgFiyat };
  };

  /* ---------------- yatırım ---------------- */
  M.npv = function (r, cf) { return cf.reduce(function (a, c, t) { return a + c / Math.pow(1 + r, t); }, 0); };
  M.irr = function (cf) {
    var lo = -0.99, hi = 5, f = function (r) { return M.npv(r, cf); };
    if (f(lo) * f(hi) > 0) return NaN;
    for (var i = 0; i < 200; i++) { var m = (lo + hi) / 2; if (f(lo) * f(m) <= 0) hi = m; else lo = m; }
    return (lo + hi) / 2;
  };
  M.payback = function (cf, r) {
    var acc = 0;
    for (var t = 0; t < cf.length; t++) {
      var c = r == null ? cf[t] : cf[t] / Math.pow(1 + r, t), prev = acc; acc += c;
      if (t > 0 && acc >= 0) return t - 1 + (-prev) / c;
    }
    return Infinity;
  };
  M.pi = function (r, cf) { return (M.npv(r, cf) - cf[0]) / -cf[0]; };
  /* sermaye tayınlaması: bütçe içinde toplam NBD'si en büyük kombinasyon (bölünemez projeler) */
  M.best = function (r, projs, budget) {
    var best = { set: [], npv: 0, cost: 0 }, n = projs.length;
    for (var mask = 0; mask < (1 << n); mask++) {
      var cost = 0, v = 0, set = [];
      for (var i = 0; i < n; i++) if (mask & (1 << i)) { cost += -projs[i].cf[0]; v += M.npv(r, projs[i].cf); set.push(projs[i].k); }
      if (cost <= budget + 1e-9 && v > best.npv + 1e-9) best = { set: set, npv: v, cost: cost };
    }
    return best;
  };

  /* ---------------- organizasyon ---------------- */
  /* N çalışan, her yönetici en çok s kişi: alttan yukarı kademe kademe yönetici sayısı */
  M.kademe = function (N, s) {
    var lv = [], n = N;
    while (n > 1) { n = Math.ceil(n / s); lv.push(n); }
    return { kademe: lv.length, yonetici: lv.reduce(function (a, x) { return a + x; }, 0), seviye: lv };
  };

  /* ---------------- simülasyon ---------------- */
  M.simBas = function (C) {
    var a = C.acilis, s = {}; Object.keys(a).forEach(function (k) { s[k] = a[k]; });
    s.q = 1; s.faiz = C.faiz; s.mod = { fiyatK: 0, talepK: 0, ucretK: 0, verimK: 0, malzemeK: 0, rakipK: 0 }; s.gec = []; s.gecmis = []; s.netler = [];
    return s;
  };
  M.aktif = function (s) { return s.kasa + s.alacak + s.stokDeger + s.makine; };
  M.pasif = function (s) { return s.satici + s.vergi + s.kredi + s.acil + s.sermaye + s.birikmis; };
  M.kapasite = function (s, C, grev) { return Math.floor(Math.min(s.hat * C.hatKapasite, s.isci * C.isciVerim * (1 + s.mod.verimK)) * (grev ? 2 / 3 : 1)); };
  M.pazar = function (s, C) { return C.pazar * Math.pow(1.02, s.q - 1) * C.mevsim[(s.q - 1) % 4] * (1 + s.mod.talepK); };
  M.cekim = function (s, C, fiyat, vade, pazarlama) {
    var pe = fiyat * (1 + s.mod.fiyatK), rf = C.rakipFiyat * (1 + s.mod.rakipK);
    return Math.pow(rf / pe, C.esneklik) * s.marka * s.kalite * (1 + 0.02 * vade / 30) * (1 + 0.15 * Math.log(1 + pazarlama / 2e6));
  };
  /* d: { fiyat, uretim, vade, pazarlama, isci (değişim), kredi (+çek/−öde), g (gündem seçeneği: fx) } */
  M.ceyrek = function (s0, d, C, gfx) {
    var s = JSON.parse(JSON.stringify(s0)), r = { q: s.q }, fx = gfx || {};
    var nk = { tahsil: 0, tedarik: 0, iscilik: 0, gider: 0, faiz: 0, vergi: 0, yatirim: 0, kredi: 0, temettu: 0 };
    /* 1. gündem etkileri */
    if (fx.fiyatK) s.mod.fiyatK += fx.fiyatK; if (fx.fiyatEk) s.mod.fiyatK += fx.fiyatEk;
    if (fx.talepK) s.mod.talepK += fx.talepK; if (fx.ucretK) s.mod.ucretK += fx.ucretK; if (fx.verimK) s.mod.verimK += fx.verimK;
    if (fx.malzemeK) { s.mod.malzemeK += fx.malzemeK; s.mod.rakipK += 0.08; }
    if (fx.kaliteK) s.kalite = Math.max(0.5, s.kalite + fx.kaliteK);
    if (fx.marka) s.marka += fx.marka;
    if (fx.markaGec) s.gec.push({ q: s.q + 2, marka: fx.markaGec });
    if (fx.faizYeni) s.faiz = (Math.min(20e6, s.kredi) * fx.faizYeni + Math.max(0, s.kredi - 20e6) * s.faiz) / Math.max(1, s.kredi);
    s.gec = s.gec.filter(function (g) { if (g.q <= s.q) { s.marka += g.marka; return false; } return true; });
    var hatEk = fx.hat || 0, capex = fx.capex || 0, giderEk = fx.gider || 0;
    /* 2. faiz (dönem başı bakiyeler üzerinden) */
    var faiz = s.kredi * s.faiz / 4 + s.acil * C.acilFaiz / 4;
    /* 3. kredi hareketleri: gündem + öğrenci */
    var kr = (fx.kredi || 0) + (d.kredi || 0);
    if (kr < 0) kr = -Math.min(-kr, s.kredi);
    s.kredi += kr; nk.kredi += kr;
    /* 4. personel */
    var di = Math.round(d.isci || 0); if (s.isci + di < 20) di = 20 - s.isci;
    var ikMaliyet = di > 0 ? di * 15000 : -di * 60000; /* işe alım / kıdem tazminatı */
    s.isci += di;
    /* 5. yatırım: yeni hat bu çeyrek devreye girer */
    s.hat += hatEk; s.makine += capex; nk.yatirim -= capex;
    /* 6. üretim (tam maliyet: malzeme + işçilik + amortisman stoğa) */
    var kap = M.kapasite(s, C, fx.grev), P = Math.max(0, Math.min(Math.round(d.uretim || 0), kap));
    var malz = P * C.malzeme * (1 + s.mod.malzemeK), isc = s.isci * C.ucret * (1 + s.mod.ucretK), amo = s.makine * C.amort;
    s.makine -= amo; s.stokAdet += P; s.stokDeger += malz + isc + amo;
    /* 7. talep ve satış */
    var vade = d.vade || 0, pz = d.pazarlama || 0, fiyat = d.fiyat;
    var a = M.cekim(s, C, fiyat, vade, pz), pay = a / (a + C.rakipCekim), M_ = M.pazar(s, C), D = Math.round(M_ * pay);
    var S = Math.min(D, s.stokAdet), pe = fiyat * (1 + s.mod.fiyatK), gelir = S * pe;
    var bm = s.stokAdet ? s.stokDeger / s.stokAdet : 0, smm = S * bm;
    s.stokAdet -= S; s.stokDeger -= smm; if (s.stokAdet === 0) s.stokDeger = 0;
    /* 8. gelir tablosu (depo: elde kalan stoğun taşıma maliyeti, çeyrekte %2) */
    var depo = s.stokDeger * C.depo, genel = C.genel + depo, faalKar = gelir - smm - genel - pz - giderEk - ikMaliyet, vok = faalKar - faiz, vergi = Math.max(0, vok) * C.vergi, net = vok - vergi;
    /* 9. nakit */
    var tahsil = s.alacak + gelir * (1 - vade / 90); s.alacak = gelir * vade / 90;
    var tedarik = s.satici + malz * 2 / 3; s.satici = malz / 3;
    var vergiOde = s.vergi; s.vergi = vergi;
    nk.tahsil = tahsil; nk.tedarik = -tedarik; nk.iscilik = -isc; nk.gider = -(genel + pz + giderEk + ikMaliyet); nk.faiz = -faiz; nk.vergi = -vergiOde;
    /* temettü: son 4 çeyreğin kârının oranı */
    var son4 = s.netler.slice(-3).reduce(function (x, y) { return x + y; }, 0) + net, tem = fx.temettu ? Math.max(0, son4) * fx.temettu : 0;
    nk.temettu = -tem;
    var acilOnce = s.acil;
    s.kasa += tahsil - tedarik - isc - genel - pz - giderEk - ikMaliyet - faiz - vergiOde - capex + kr - tem;
    s.birikmis += net - tem;
    /* 10. kasa eksiye düşerse otomatik acil kredi; fazla nakit acil krediyi kapatır */
    var acil = 0;
    if (s.kasa < 0) { acil = -s.kasa + 500000; s.acil += acil; s.kasa += acil; }
    else if (s.acil > 0 && s.kasa > 5e6) { acil = -Math.min(s.acil, s.kasa - 5e6); s.acil += acil; s.kasa += acil; }
    nk.acil = s.acil - acilOnce;
    /* rapor */
    r.gelirT = { sat: gelir, smm: smm, brut: gelir - smm, genel: genel, depo: depo, pazarlama: pz, diger: giderEk + ikMaliyet, faal: faalKar, faiz: faiz, vok: vok, vergi: vergi, net: net, tem: tem };
    r.nakitT = { isletme: nk.tahsil + nk.tedarik + nk.iscilik + nk.gider + nk.faiz + nk.vergi, yatirim: nk.yatirim, finansman: nk.kredi + nk.acil + nk.temettu };
    r.nakitT.net = r.nakitT.isletme + r.nakitT.yatirim + r.nakitT.finansman;
    r.op = { pazar: M_, pay: S / M_, talep: D, satis: S, kacan: D - S, uretim: P, kapasite: kap, kullanim: kap ? P / kap : 0, birimMal: P ? (malz + isc + amo) / P : bm, fiyat: pe, grev: !!fx.grev, acil: acil };
    s.netler.push(net);
    s.q += 1;
    r.bil = { kasa: s.kasa, alacak: s.alacak, stok: s.stokDeger, makine: s.makine, satici: s.satici, vergi: s.vergi, kredi: s.kredi, acil: s.acil, sermaye: s.sermaye, birikmis: s.birikmis };
    r.aktif = M.aktif(s); r.pasif = M.pasif(s);
    var kvb = s.satici + s.vergi + s.acil;
    r.oran = { cari: kvb ? (s.kasa + s.alacak + s.stokDeger) / kvb : Infinity, borcOz: (s.kredi + s.acil + s.satici + s.vergi) / Math.max(1, s.sermaye + s.birikmis), roe: net * 4 / Math.max(1, s.sermaye + s.birikmis), marj: gelir ? net / gelir : 0 };
    s.gecmis.push(r);
    return { s: s, r: r };
  };
  /* karne: 0–100 */
  M.karne = function (s, C) {
    var oz = s.sermaye + s.birikmis, oz0 = C.acilis.sermaye + C.acilis.birikmis, top = s.netler.reduce(function (a, b) { return a + b; }, 0);
    var son = s.gecmis[s.gecmis.length - 1] || { oran: { cari: 1 }, op: { pay: 0.2 } };
    var p = 0, items = [];
    var iflas = oz <= 0;
    var roe = top / oz0 / (s.netler.length / 4 || 1);
    var pk = Math.max(0, Math.min(35, roe / 0.15 * 35)); p += pk; items.push([roe >= 0.10, 'yıllık özkaynak kârlılığı %' + (roe * 100).toFixed(1)]);
    var cr = son.oran.cari, ck = cr >= 1.5 ? 20 : cr >= 1.2 ? 15 : cr >= 1 ? 8 : 0; p += ck; items.push([cr >= 1.2, 'son cari oran ' + (isFinite(cr) ? cr.toFixed(2) : '∞')]);
    var acilQ = s.gecmis.filter(function (r) { return r.bil.acil > 0; }).length, ak = Math.max(0, 15 - acilQ * 4); p += ak; items.push([acilQ === 0, acilQ ? acilQ + ' çeyrek acil krediye düştün' : 'kasa hiç eksiye düşmedi']);
    var pay = son.op.pay, pk2 = Math.max(0, Math.min(20, pay / 0.25 * 20)); p += pk2; items.push([pay >= 0.2, 'son pazar payı %' + (pay * 100).toFixed(1)]);
    var kacan = s.gecmis.reduce(function (a, r) { return a + r.op.kacan; }, 0), sat = s.gecmis.reduce(function (a, r) { return a + r.op.talep; }, 0), kk = sat ? Math.max(0, 10 - kacan / sat * 50) : 0; p += kk;
    items.push([kacan / Math.max(1, sat) < 0.05, 'kaçan satış talebin %' + (kacan / Math.max(1, sat) * 100).toFixed(1) + '\'i']);
    if (iflas) { p = Math.min(p, 10); items.unshift([false, 'özkaynak eksiye düştü: şirket teknik olarak iflas etti']); }
    return { puan: Math.round(p), items: items, top: top, roe: roe, iflas: iflas };
  };

  window.SKM = M;
})();
