/* ==========================================================================
   ACADEX ODYOLOJİ LAB · sanal hasta modeli (labs/odyoloji/odyo-model.js), 29.10.2026
   Saf DOM'suz modül: tarayıcıda window.AXODY, Node'da module.exports (tests/odyoloji-lab.js).

   EĞİTİM AMAÇLIDIR. Vakalar kurgusaldır; eşikler ders kitabı örüntülerine göre yazıldı.
   Kurallar (klinik öğretimde yaygın kabul):
     - Kulaklık (supra-aural) için kulaklar arası azalma (IA) 40 dB, kemik yolu için 0 dB.
     - Çapraz ses öbür kulağın KOKLEASINA (kemik yolu eşiğine) ulaşır.
     - Maskeleme gürültüsü öbür kulağa kulaklıkla verilir; kokleaya ulaşan gürültü, o kulağın
       hava-kemik aralığı kadar azalır. Gürültü de IA kadar azalarak test kulağına geçer
       (aşırı maskeleme).
     - Psikometrik yanıt: eşiğin 5 dB üstü kesin, eşikte ~%75, 5 dB altı ~%15, daha altı yok.
     - Derece: Clark (1981) ölçeği, saf ses ortalaması (SSO) 500-1000-2000 Hz.
   ========================================================================== */
(function (root, factory) {
  var M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M; else root.AXODY = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var FREQS = [250, 500, 1000, 2000, 3000, 4000, 6000, 8000];
  var BC_FREQS = [250, 500, 1000, 2000, 3000, 4000];
  var IA = { ac: 40, bc: 0 };
  var MAX = { ac: { 250: 105, 500: 120, 1000: 120, 2000: 120, 3000: 120, 4000: 120, 6000: 110, 8000: 105 }, bc: { 250: 45, 500: 65, 1000: 70, 2000: 70, 3000: 70, 4000: 70 } };
  var MIN = -10;
  var other = function (e) { return e === 'R' ? 'L' : 'R'; };
  var row = function (a) { var o = {}; FREQS.forEach(function (f, i) { if (a[i] != null) o[f] = a[i]; }); return o; };

  /* ---------- sanal hastalar (kabin) ve vakalar ---------- */
  /* ac/bc: [250,500,1k,2k,3k,4k,6k,8k] dB HL. ans: doğru yorum (tip, derece, konfigürasyon). */
  var P = {};
  var add = function (o) { o.ac = { R: row(o.acR), L: row(o.acL) }; o.bc = { R: row(o.bcR), L: row(o.bcL) }; P[o.id] = o; return o; };
  add({ id: 'normal', ad: 'Ayşe', yas: 24, seviye: 1, kabin: true,
    ozet: 'Okul sağlık taraması için gelen, şikâyeti olmayan genç kadın.',
    acR: [10, 5, 5, 10, 5, 10, 15, 10], bcR: [5, 5, 5, 5, 5, 10],
    acL: [5, 10, 5, 5, 10, 5, 10, 15], bcL: [5, 5, 5, 5, 5, 5],
    srt: { R: 5, L: 5 }, sd: { R: 100, L: 100 },
    ans: { R: { tip: 'normal', derece: 'normal', konf: 'duz' }, L: { tip: 'normal', derece: 'normal', konf: 'duz' } } });
  add({ id: 'ome', ad: 'Elif', yas: 6, seviye: 2, kabin: true,
    ozet: 'Üst solunum yolu enfeksiyonundan sonra seslenince duymadığı fark edilen çocuk.',
    acR: [35, 35, 30, 25, 25, 25, 20, 25], bcR: [5, 5, 10, 5, 5, 5],
    acL: [35, 35, 30, 30, 25, 25, 25, 25], bcL: [5, 5, 5, 10, 5, 5],
    srt: { R: 30, L: 30 }, sd: { R: 96, L: 96 },
    ans: { R: { tip: 'iletim', derece: 'hafif', konf: 'duz' }, L: { tip: 'iletim', derece: 'hafif', konf: 'duz' } } });
  add({ id: 'presbi', ad: 'Hasan', yas: 68, seviye: 1, kabin: true,
    ozet: 'Kalabalıkta ve gürültüde konuşmaları anlamakta zorlanan emekli öğretmen.',
    acR: [20, 20, 25, 40, 55, 60, 70, 75], bcR: [15, 20, 25, 35, 50, 55],
    acL: [20, 25, 25, 40, 50, 60, 70, 80], bcL: [20, 20, 20, 35, 45, 55],
    srt: { R: 25, L: 25 }, sd: { R: 76, L: 72 },
    ans: { R: { tip: 'sensorinoral', derece: 'hafif', konf: 'dusen' }, L: { tip: 'sensorinoral', derece: 'hafif', konf: 'dusen' } } });
  add({ id: 'gurultu', ad: 'Murat', yas: 45, seviye: 1, kabin: true,
    ozet: '20 yıldır metal fabrikasında çalışan, iki kulakta çınlama tarifleyen işçi.',
    acR: [10, 10, 15, 25, 45, 55, 40, 25], bcR: [10, 10, 15, 20, 40, 50],
    acL: [10, 15, 15, 25, 40, 55, 45, 30], bcL: [10, 10, 15, 20, 40, 50],
    srt: { R: 15, L: 15 }, sd: { R: 92, L: 92 },
    ans: { R: { tip: 'sensorinoral', derece: 'cok_hafif', konf: 'centikli' }, L: { tip: 'sensorinoral', derece: 'cok_hafif', konf: 'centikli' } } });
  add({ id: 'otoskleroz', ad: 'Zeynep', yas: 34, seviye: 2, kabin: true,
    ozet: 'Son iki yılda giderek artan işitme azlığı; gebelikten sonra arttığını söylüyor, annesinde de benzer şikâyet var.',
    acR: [45, 45, 40, 35, 40, 40, 45, 50], bcR: [5, 10, 10, 25, 15, 10],
    acL: [35, 35, 30, 30, 30, 35, 40, 40], bcL: [5, 10, 10, 25, 10, 10],
    srt: { R: 40, L: 30 }, sd: { R: 96, L: 100 },
    ans: { R: { tip: 'iletim', derece: 'hafif', konf: 'duz' }, L: { tip: 'iletim', derece: 'hafif', konf: 'duz' } } });
  add({ id: 'meniere', ad: 'Deniz', yas: 40, seviye: 2, kabin: true,
    ozet: 'Ataklar hâlinde baş dönmesi, sağ kulakta dolgunluk ve uğultu; işitmesi gün gün değişiyor.',
    acR: [50, 45, 35, 25, 20, 20, 25, 30], bcR: [45, 40, 30, 20, 15, 15],
    acL: [10, 10, 5, 10, 10, 10, 15, 15], bcL: [5, 5, 5, 10, 5, 10],
    srt: { R: 35, L: 5 }, sd: { R: 80, L: 100 },
    ans: { R: { tip: 'sensorinoral', derece: 'hafif', konf: 'yukselen' }, L: { tip: 'normal', derece: 'normal', konf: 'duz' } } });
  add({ id: 'noroma', ad: 'Emre', yas: 30, seviye: 2, kabin: true,
    ozet: 'Sağ kulakta yavaş ilerleyen işitme kaybı ve çınlama; telefonu hep sol kulağına götürüyor.',
    acR: [15, 20, 25, 35, 45, 50, 55, 60], bcR: [15, 20, 20, 30, 40, 45],
    acL: [10, 10, 10, 10, 15, 15, 15, 20], bcL: [5, 10, 10, 10, 10, 15],
    srt: { R: 25, L: 10 }, sd: { R: 40, L: 100 },
    ans: { R: { tip: 'sensorinoral', derece: 'hafif', konf: 'dusen' }, L: { tip: 'normal', derece: 'normal', konf: 'duz' } } });
  add({ id: 'ani', ad: 'Selin', yas: 52, seviye: 3, kabin: true,
    ozet: 'İki gün önce sabah uyandığında sol kulağının duymadığını fark etmiş; sol kulakta çınlama var.',
    acR: [10, 10, 10, 15, 15, 15, 20, 20], bcR: [5, 10, 10, 10, 15, 15],
    acL: [55, 60, 65, 70, 70, 75, 80, 80], bcL: [45, 55, 60, 65, 65, 70],
    srt: { R: 10, L: 65 }, sd: { R: 100, L: 60 },
    ans: { R: { tip: 'normal', derece: 'normal', konf: 'duz' }, L: { tip: 'sensorinoral', derece: 'orta_ileri', konf: 'duz' } } });
  add({ id: 'kom', ad: 'Kemal', yas: 60, seviye: 3, kabin: true,
    ozet: 'Çocukluğundan beri sol kulağından ara ara akıntı geliyor; sol kulakta işitme azlığı.',
    acR: [15, 15, 10, 15, 20, 20, 25, 30], bcR: [10, 10, 10, 15, 15, 20],
    acL: [60, 60, 65, 70, 70, 75, 80, 85], bcL: [25, 30, 35, 45, 50, 55],
    srt: { R: 15, L: 65 }, sd: { R: 100, L: 84 },
    ans: { R: { tip: 'normal', derece: 'normal', konf: 'duz' }, L: { tip: 'mikst', derece: 'orta_ileri', konf: 'dusen' } } });

  /* ---------- etiketler ---------- */
  var TIP = { normal: 'Normal işitme', iletim: 'İletim tipi', sensorinoral: 'Sensörinöral', mikst: 'Mikst tip' };
  var DERECE = [ /* Clark (1981), SSO 500-1000-2000 Hz */
    { k: 'normal', t: 'Normal', max: 15 }, { k: 'cok_hafif', t: 'Çok hafif', max: 25 }, { k: 'hafif', t: 'Hafif', max: 40 },
    { k: 'orta', t: 'Orta', max: 55 }, { k: 'orta_ileri', t: 'Orta-ileri', max: 70 }, { k: 'ileri', t: 'İleri', max: 90 }, { k: 'cok_ileri', t: 'Çok ileri', max: 999 }];
  var KONF = { duz: 'Düz', dusen: 'Düşen (eğimli)', yukselen: 'Yükselen', centikli: 'Çentikli (4 kHz)' };

  /* ---------- hesaplar ---------- */
  var bcAt = function (p, ear, f) { /* 6-8 kHz kemik yolu ölçülmez: 4 kHz hava-kemik aralığıyla tahmin */
    var b = p.bc[ear][f]; if (b != null) return b;
    var gap = (p.ac[ear][4000] - p.bc[ear][4000]) || 0; return p.ac[ear][f] - gap;
  };
  var gapAt = function (p, ear, f) { return Math.max(0, p.ac[ear][f] - bcAt(p, ear, f)); };
  var sso = function (row) { return Math.round((row[500] + row[1000] + row[2000]) / 3 * 10) / 10; };
  var derece = function (pta) { for (var i = 0; i < DERECE.length; i++) if (pta <= DERECE[i].max) return DERECE[i].k; return 'cok_ileri'; };
  var tip = function (ac, bc) { /* SSO'lara göre: hava-kemik aralığı ≥ 15 dB iletim bileşeni demektir */
    var a = sso(ac), b = sso(bc), gap = a - b;
    if (a <= 15) return 'normal';
    if (gap >= 15) return b <= 15 ? 'iletim' : 'mikst';
    return 'sensorinoral';
  };

  /* psikometrik yanıt olasılığı (margin = verilen seviye - etkin eşik) */
  var prob = function (margin) { return margin >= 5 ? 1 : margin >= 0 ? 0.75 : margin >= -5 ? 0.15 : 0; };

  /* Etkin eşikler. stim: {ear, mode:'ac'|'bc', f, L, mask:{on, M}} */
  var effective = function (p, stim) {
    var t = stim.ear, n = other(t), f = stim.f, mOn = !!(stim.mask && stim.mask.on), M = mOn ? stim.mask.M : -999;
    var tCoch = bcAt(p, t, f), nCoch = bcAt(p, n, f);
    var nMasked = mOn ? Math.max(nCoch, M - gapAt(p, n, f)) : nCoch;      /* öbür koklea, gürültüyle yükselmiş eşik */
    var tMasked = mOn ? Math.max(tCoch, M - IA.ac) : tCoch;                /* aşırı maskeleme: gürültü test kokleasına geçer */
    var direct = stim.mode === 'ac' ? Math.max(p.ac[t][f], tMasked + gapAt(p, t, f)) : tMasked;
    var cross = nMasked + IA[stim.mode];                                     /* bu seviyede verilirse öbür koklea duyar */
    return { direct: direct, cross: cross, overmask: mOn && M - IA.ac > tCoch, undermask: mOn && cross <= direct };
  };
  /* rnd: 0..1 üreten fonksiyon (testte sabit) */
  var respond = function (p, stim, rnd) {
    rnd = rnd || Math.random;
    var max = (MAX[stim.mode] || {})[stim.f]; if (max == null) return { heard: false, via: null, noStim: true };
    var L = Math.min(stim.L, max), e = effective(p, stim);
    var md = L - e.direct, mc = L - e.cross, best = Math.max(md, mc);
    var heard = rnd() < prob(best);
    return { heard: heard, via: heard ? (md >= mc ? 'test' : 'cross') : null, overmask: e.overmask, eff: e };
  };
  /* öğrencinin bulması gereken gerçek eşik (maskeleme yeterliyken) */
  var truth = function (p, ear, mode, f) { return mode === 'ac' ? p.ac[ear][f] : bcAt(p, ear, f); };
  /* maskesiz ölçülürse görülecek eşik (gölge eğri dahil) */
  var unmaskedSeen = function (p, ear, mode, f) { var e = effective(p, { ear: ear, mode: mode, f: f, L: 0 }); return Math.min(e.direct, e.cross); };
  /* klinik kurallar: maskeleme gerekiyor mu? */
  var needMask = function (p, ear, mode, f) {
    var n = other(ear);
    if (mode === 'ac') return p.ac[ear][f] - IA.ac >= bcAt(p, n, f);         /* AC test - IA ≥ öbür kulak BC */
    /* kemik yolu iki kokleayı birden uyarır: maskesiz BC, test kulağının AC'sinden 10 dB'den fazla iyiyse maskele */
    return p.ac[ear][f] - unmaskedSeen(p, ear, 'bc', f) > 10;
  };
  /* başlangıç ve plato için önerilen maskeleme seviyesi (plato yöntemi kaba kuralı) */
  var maskRange = function (p, ear, mode, f) {
    var n = other(ear), tCoch = bcAt(p, ear, f);
    var min = p.ac[n][f] + 10;                                               /* öbür kulak AC eşiği + 10 */
    var max = tCoch + IA.ac - 5;                                             /* aşırı maskeleme sınırı */
    return { min: min, max: max, dilemma: max < min };
  };

  /* ---------- öğrencinin odyogramını puanla ---------- */
  /* marks: {'R.ac.1000': {L, masked, nr}} ; kapsam: AC 250-8k, BC 500-4k (her kulak) */
  var SCOPE = []; ['R', 'L'].forEach(function (e) { FREQS.forEach(function (f) { SCOPE.push([e, 'ac', f]); }); [500, 1000, 2000, 4000].forEach(function (f) { SCOPE.push([e, 'bc', f]); }); });
  var grade = function (p, marks) {
    var rows = [], ok = 0;
    SCOPE.forEach(function (s) {
      var k = s.join('.'), m = marks[k], tr = truth(p, s[0], s[1], s[2]), need = needMask(p, s[0], s[1], s[2]);
      var r = { key: k, ear: s[0], mode: s[1], f: s[2], truth: tr, need: need, mark: m || null, res: 'eksik' };
      if (m) {
        if (m.nr) r.res = tr > (MAX[s[1]][s[2]] || 0) ? 'dogru' : 'yanlis';
        else if (Math.abs(m.L - tr) <= 5 && (!need || m.masked)) r.res = 'dogru';
        else if (need && !m.masked && Math.abs(m.L - unmaskedSeen(p, s[0], s[1], s[2])) <= 5) r.res = 'golge';
        else if (Math.abs(m.L - tr) <= 5 && need && !m.masked) r.res = 'maskesiz';
        else r.res = 'yanlis';
      }
      if (r.res === 'dogru') ok++;
      rows.push(r);
    });
    return { rows: rows, ok: ok, total: rows.length, pct: Math.round(ok / rows.length * 100) };
  };

  /* ---------- vaka masası ---------- */
  var TESTS = {
    otoskopi: { t: 'Otoskopi', d: 'Dış kulak yolu ve kulak zarı muayenesi' },
    odyometri: { t: 'Saf ses odyometri', d: 'Hava ve kemik yolu eşikleri, maskeleme' },
    konusma: { t: 'Konuşma odyometrisi', d: 'Konuşmayı alma eşiği (SRT) ve ayırt etme (SD)' },
    timpanometri: { t: 'Timpanometri', d: 'Orta kulak basıncı ve hareketliliği' },
    refleks: { t: 'Akustik refleks', d: 'İpsilateral / kontralateral stapes refleksi, refleks kayması' },
    oae: { t: 'Otoakustik emisyon', d: 'TEOAE / DPOAE: dış tüy hücresi işlevi' },
    abr: { t: 'İşitsel beyin sapı yanıtı (ABR)', d: 'Dalga I–V latansları ve eşik' }
  };
  var TIMP = { A: { t: 'Tip A', tepe: -15, uyum: 0.7 }, As: { t: 'Tip As', tepe: -10, uyum: 0.2 }, Ad: { t: 'Tip Ad', tepe: -10, uyum: 2.1 }, B: { t: 'Tip B', tepe: null, uyum: 0 }, C: { t: 'Tip C', tepe: -240, uyum: 0.6 } };
  var CASES = [
    { id: 'v-ome', hasta: 'ome', baslik: '6 yaşında çocuk: "seslenince bakmıyor"',
      oyku: 'Annesi, iki haftadır seslenince tepki vermediğini, televizyonu yüksek açtığını söylüyor. Üç hafta önce üst solunum yolu enfeksiyonu geçirmiş. Ateş ve kulak akıntısı yok.',
      sonuc: { otoskopi: 'Her iki kulak zarı mat, hafif içe çekik; ışık refleksi seçilmiyor, zar arkasında sıvı seviyesi şüphesi.',
        timpanometri: { R: 'B', L: 'B', ecv: { R: 0.7, L: 0.7 } }, refleks: 'İki kulakta ipsi ve kontralateral refleks alınamadı.',
        oae: 'TEOAE iki kulakta yanıt yok (orta kulak sıvısı emisyonları engeller).', abr: 'Klik ABR: dalga V iki kulakta 35 dB nHL\'ye kadar izlendi; latanslar iletim tipi kayıpla uyumlu uzamış.' },
      gerekli: ['otoskopi', 'odyometri', 'timpanometri'], yararli: ['refleks', 'konusma'],
      tani: ['Seröz otitis media (efüzyonlu otitis media)', 'Otoskleroz', 'Ani sensörinöral işitme kaybı', 'İşitsel nöropati'], dogru: 0,
      yon: ['KBB\'ye yönlendirme ve 3 ay izlem, kontrol timpanometri', 'Hemen işitme cihazı', 'Acil steroid tedavisi', 'Koklear implant değerlendirmesi'], dyon: 0,
      not: 'Çocukluk çağında en sık iletim tipi kayıp nedeni. Tip B timpanogram + normal kulak yolu hacmi = orta kulakta sıvı. Çoğu kendiliğinden geriler; 3 aydan uzun sürer ya da konuşma gelişimini etkilerse ventilasyon tüpü düşünülür.' },
    { id: 'v-oto', hasta: 'otoskleroz', baslik: '34 yaşında kadın: yavaş artan işitme azlığı',
      oyku: 'İki yıldır giderek artan, iki taraflı işitme azlığı. Gebeliğinden sonra belirginleşmiş. Gürültülü ortamda daha iyi duyduğunu söylüyor (paracusis Willisii). Annesinde de işitme kaybı var.',
      sonuc: { otoskopi: 'Her iki kulak zarı normal görünümde. Sağda promontoryumda pembe yansıma (Schwartze bulgusu) şüphesi.',
        timpanometri: { R: 'As', L: 'As', ecv: { R: 1.2, L: 1.1 } }, refleks: 'İki kulakta ipsi ve kontralateral refleks alınamadı.',
        oae: 'TEOAE iki kulakta yanıt yok.', abr: 'Dalga V latansları iletim tipi kayıpla uyumlu; interpik aralıklar normal.' },
      gerekli: ['otoskopi', 'odyometri', 'timpanometri', 'refleks'], yararli: ['konusma'],
      tani: ['Otoskleroz', 'Seröz otitis media', 'Presbiakuzi', 'Kemikçik zinciri kopukluğu'], dogru: 0,
      yon: ['KBB\'ye yönlendirme: stapes cerrahisi ya da işitme cihazı seçenekleri', 'Yalnızca yıllık izlem', 'Acil MR', 'Vestibüler rehabilitasyon'], dyon: 0,
      not: 'Stapes tabanının fiksasyonu: iletim tipi kayıp, As tipi (düşük uyum) timpanogram ve kaybolan refleksler. Kemik yolunda 2 kHz civarındaki çentik Carhart çentiğidir (gerçek koklear kayıp değil, mekanik bir etkidir).' },
    { id: 'v-presbi', hasta: 'presbi', baslik: '68 yaşında erkek: "duyuyorum ama anlamıyorum"',
      oyku: 'Torunlarının konuşmasını ve kalabalık ortamları anlamakta zorlanıyor. Televizyon sesinden eşi şikâyetçi. Yavaş başlamış, iki kulakta eşit.',
      sonuc: { otoskopi: 'Her iki dış kulak yolu ve kulak zarı doğal.',
        timpanometri: { R: 'A', L: 'A', ecv: { R: 1.3, L: 1.4 } }, refleks: 'Refleksler alçak frekanslarda normal seviyede, yüksek frekanslarda yükselmiş ya da yok.',
        oae: 'DPOAE 2 kHz üstünde yanıt yok.', abr: 'Dalga latansları yüksek frekans kaybıyla uyumlu; interpik aralıklar normal, kulaklar arası fark yok.' },
      gerekli: ['otoskopi', 'odyometri', 'konusma'], yararli: ['timpanometri'], gereksiz: ['abr'],
      tani: ['Presbiakuzi (yaşa bağlı işitme kaybı)', 'Gürültüye bağlı işitme kaybı', 'Ménière hastalığı', 'Otoskleroz'], dogru: 0,
      yon: ['İki taraflı işitme cihazı değerlendirmesi ve iletişim danışmanlığı', 'Acil KBB', 'Stapes cerrahisi', 'MR çekilmesi'], dyon: 0,
      not: 'Simetrik, yüksek frekanslarda düşen sensörinöral kayıp. Konuşmayı ayırt etme skoru eşiklere göre düşük olabilir; cihaz beklentisi konuşurken açıkça konuşulmalı.' },
    { id: 'v-gurultu', hasta: 'gurultu', baslik: '45 yaşında fabrika işçisi: kulak çınlaması',
      oyku: '20 yıldır metal işleme atölyesinde çalışıyor, koruyucuyu düzenli takmıyor. İki kulakta sürekli tiz çınlama. İşitme kaybı fark etmemiş.',
      sonuc: { otoskopi: 'Her iki kulak doğal.', timpanometri: { R: 'A', L: 'A', ecv: { R: 1.3, L: 1.3 } }, refleks: 'Refleksler alınıyor.',
        oae: 'DPOAE 3–6 kHz bandında belirgin azalmış, diğer frekanslarda yanıt var.', abr: 'Normal latanslar.' },
      gerekli: ['otoskopi', 'odyometri'], yararli: ['timpanometri', 'oae'], gereksiz: ['abr'],
      tani: ['Gürültüye bağlı işitme kaybı', 'Presbiakuzi', 'Otoskleroz', 'Akustik nörinom'], dogru: 0,
      yon: ['Kulak koruyucu kullanımı, işyeri gürültü değerlendirmesi ve yıllık odyometrik izlem', 'Acil steroid', 'Stapes cerrahisi', 'Koklear implant'], dyon: 0,
      not: '3–6 kHz bandında (özellikle 4 kHz) çentik, 8 kHz\'de toparlanma tipiktir. Kayıp kalıcıdır; amaç ilerlemeyi durdurmaktır.' },
    { id: 'v-ani', hasta: 'ani', baslik: '52 yaşında kadın: sabah uyanınca sol kulak duymuyor',
      oyku: 'İki gün önce sabah uyandığında sol kulağında işitme azlığı ve çınlama fark etmiş. Baş dönmesi hafif. Travma, gürültü ya da enfeksiyon öyküsü yok.',
      sonuc: { otoskopi: 'Her iki kulak zarı doğal.', timpanometri: { R: 'A', L: 'A', ecv: { R: 1.2, L: 1.2 } }, refleks: 'Sol kulak uyarımıyla refleksler yükselmiş eşikte.',
        oae: 'Solda TEOAE yanıt yok, sağda yanıt var.', abr: 'Tanı için öncelikli değil; MR planlanırsa gerekmeyebilir.' },
      gerekli: ['otoskopi', 'odyometri', 'timpanometri'], yararli: ['konusma'],
      tani: ['Ani sensörinöral işitme kaybı', 'Seröz otitis media', 'Presbiakuzi', 'Otoskleroz'], dogru: 0,
      yon: ['ACİL KBB: tedavi (genellikle steroid) ilk günlerde başlamalı; ardından MR', '3 ay sonra kontrol', 'İşitme cihazı denemesi', 'Yalnızca çınlama danışmanlığı'], dyon: 0,
      not: '72 saat içinde ≥30 dB, ardışık üç frekansta sensörinöral kayıp. Tedaviye erken başlamak sonucu etkiler; bu bir acildir. Sol kulak ölçülürken sağ kulak maskelenmezse gölge eğri görülür.' },
    { id: 'v-meniere', hasta: 'meniere', baslik: '40 yaşında kadın: dönme atakları ve dolgunluk',
      oyku: 'Son altı ayda 20 dakika ile birkaç saat süren dönme tarzı baş dönmesi atakları, bulantı. Atakla birlikte sağ kulakta dolgunluk, uğultu ve işitmede azalma; ataklar arasında düzeliyor gibi.',
      sonuc: { otoskopi: 'Doğal.', timpanometri: { R: 'A', L: 'A', ecv: { R: 1.1, L: 1.2 } }, refleks: 'Refleksler alınıyor (sağda rekrütmanla uyumlu, eşik-refleks aralığı dar).',
        oae: 'Sağda alçak frekanslarda yanıt yok.', abr: 'Latanslar normal; retrokoklear bulgu yok.' },
      gerekli: ['otoskopi', 'odyometri', 'timpanometri'], yararli: ['konusma', 'refleks'],
      tani: ['Ménière hastalığı', 'Benign paroksismal pozisyonel vertigo', 'Otoskleroz', 'Presbiakuzi'], dogru: 0,
      yon: ['KBB ve vestibüler değerlendirme (VNG, gerekirse ECochG), atak günlüğü', 'Yalnızca işitme cihazı', 'Stapes cerrahisi', 'Acil MR'], dyon: 0,
      not: 'Alçak frekanslarda yükselen (yukarı doğru) sensörinöral kayıp, dalgalanan işitme, dolgunluk, çınlama ve dakikalar-saatler süren vertigo atakları.' },
    { id: 'v-noroma', hasta: 'noroma', baslik: '30 yaşında erkek: tek taraflı ilerleyen kayıp',
      oyku: 'Sağ kulakta bir yıldır yavaş ilerleyen işitme azlığı ve çınlama. Telefonu hep sol kulağına tutuyor. Ara ara dengesizlik hissi.',
      sonuc: { otoskopi: 'Doğal.', timpanometri: { R: 'A', L: 'A', ecv: { R: 1.3, L: 1.3 } }, refleks: 'Sağ kulak uyarımıyla ipsi ve kontralateral refleks alınamadı; sağda refleks kayması (decay) pozitif.',
        oae: 'Sağda yanıt var (koklea çalışıyor).', abr: 'Sağda I–V interpik aralığı 4,8 ms (uzamış); kulaklar arası dalga V farkı 0,6 ms.' },
      gerekli: ['odyometri', 'konusma', 'refleks', 'abr'], yararli: ['timpanometri', 'oae'],
      tani: ['Retrokoklear patoloji şüphesi (vestibüler schwannom)', 'Ménière hastalığı', 'Presbiakuzi', 'Seröz otitis media'], dogru: 0,
      yon: ['KBB / nöro-otoloji ve iç kulak yolu MR\'ı', 'Hemen işitme cihazı', 'Ventilasyon tüpü', 'Yalnızca 1 yıl sonra kontrol'], dyon: 0,
      not: 'Asimetrik sensörinöral kayıp + eşiklere göre orantısız düşük konuşmayı ayırt etme + refleks bulguları + uzamış interpik aralık: retrokoklear patoloji. Kesin tanı MR iledir.' },
    { id: 'v-ansd', hasta: null, baslik: '2 günlük bebek: yenidoğan taraması',
      oyku: 'Yenidoğan yoğun bakımda 7 gün kalmış, kan değişimi gerektiren hiperbilirubinemi öyküsü var. Yenidoğan işitme taraması yapılacak.',
      sonuc: { otoskopi: 'Kulak yolları açık, zarlar seçiliyor.', timpanometri: { R: 'A', L: 'A', ecv: { R: 0.4, L: 0.4 } }, refleks: 'İki kulakta refleks alınamadı.',
        oae: 'TEOAE iki kulakta GEÇTİ (yanıt var).', abr: 'Otomatik ABR iki kulakta KALDI. Tanısal ABR: nöral dalgalar izlenmiyor; uyaran polaritesi değişince tersine dönen koklear mikrofonik izleniyor.',
        odyometri: 'Yenidoğanda davranışsal odyometri yapılamaz.', konusma: 'Yenidoğanda uygulanamaz.' },
      gerekli: ['oae', 'abr'], yararli: ['timpanometri', 'refleks'], gereksiz: ['odyometri', 'konusma'],
      tani: ['İşitsel nöropati spektrum bozukluğu', 'Normal işitme', 'Seröz otitis media', 'Gürültüye bağlı işitme kaybı'], dogru: 0,
      yon: ['Çocuk odyolojisi ve KBB: tanısal ABR izlemi, erken müdahale ve aile danışmanlığı', 'Taramayı geçti, izlem gerekmez', 'Acil steroid', 'Stapes cerrahisi'], dyon: 0,
      not: 'OAE varken ABR\'nin olmaması: dış tüy hücreleri çalışıyor, sinirsel iletim bozuk. Riskli (yoğun bakım) bebeklerde tarama yalnız OAE ile yapılmaz; ABR şarttır.' },
    { id: 'v-kom', hasta: 'kom', baslik: '60 yaşında erkek: akıntılı sol kulak',
      oyku: 'Çocukluğundan beri sol kulağından ara ara kötü kokulu olmayan akıntı. Sol kulakta işitme azlığı yıllar içinde artmış.',
      sonuc: { otoskopi: 'Sol kulak zarında geniş santral perforasyon, orta kulak mukozası nemli. Sağ kulak doğal.',
        timpanometri: { R: 'A', L: 'B', ecv: { R: 1.3, L: 4.2 } }, refleks: 'Sol kulakta ölçülemedi (perforasyon); sağ ipsi refleks alınıyor.',
        oae: 'Solda yanıt yok.', abr: 'Tanı için öncelikli değil.' },
      gerekli: ['otoskopi', 'odyometri', 'timpanometri'], yararli: ['konusma'], gereksiz: ['abr'],
      tani: ['Kronik otitis media (perforasyonlu), mikst tip kayıp', 'Otoskleroz', 'Ani sensörinöral işitme kaybı', 'Presbiakuzi'], dogru: 0,
      yon: ['KBB: cerrahi değerlendirme (timpanoplasti), kulağı kuru tutma', 'Yalnızca işitme cihazı', 'Acil MR', 'Vestibüler rehabilitasyon'], dyon: 0,
      not: 'Düz (B) timpanogram ama kulak yolu hacmi çok yüksek (4,2 ml): perforasyon. Uzun süren orta kulak hastalığı iç kulağı da etkileyince kayıp mikst tipe döner.' }
  ];
  var gradeCase = function (c, picked, tani, yon) {
    var need = c.gerekli || [], extra = c.gereksiz || [];
    var missing = need.filter(function (t) { return picked.indexOf(t) < 0; }), wasted = picked.filter(function (t) { return extra.indexOf(t) >= 0; });
    var pts = 0; pts += (need.length - missing.length) / need.length * 40; pts -= wasted.length * 5;
    if (tani === c.dogru) pts += 35; if (yon === c.dyon) pts += 25;
    return { puan: Math.max(0, Math.round(pts)), missing: missing, wasted: wasted, taniOk: tani === c.dogru, yonOk: yon === c.dyon };
  };

  return { FREQS: FREQS, BC_FREQS: BC_FREQS, IA: IA, MAX: MAX, MIN: MIN, P: P, TIP: TIP, DERECE: DERECE, KONF: KONF,
    TESTS: TESTS, TIMP: TIMP, CASES: CASES, other: other, bcAt: bcAt, gapAt: gapAt, sso: sso, derece: derece, tip: tip, prob: prob,
    effective: effective, respond: respond, truth: truth, unmaskedSeen: unmaskedSeen, needMask: needMask, maskRange: maskRange,
    grade: grade, gradeCase: gradeCase, SCOPE: SCOPE };
});
