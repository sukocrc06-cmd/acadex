/* ==========================================================================
   ACADEX DİYET LAB · model (labs/diyet/diyet-model.js), 29.10.2026
   Saf DOM'suz modül: tarayıcıda window.AXDIYET, Node'da module.exports (tests/diyet-lab.js).
   EĞİTİM AMAÇLIDIR. Vakalar kurgusaldır; bireysel diyet önerisi değildir.

   Kaynaklar (kısaltılmış; ayrıntı sayfadaki "kaynaklar" kutusunda):
     - Türkiye Beslenme Rehberi (TÜBER) 2022: enerji dağılımı KH %45-60, yağ %20-35, protein %10-20.
       TÜBER mikro besin değerleri EFSA referanslarına dayanır; tablo değerleri burada EFSA'dan alındı.
     - WHO: sodyum < 2 g/gün (tuz < 5 g), doymuş yağ < %10 enerji, BKİ ve bel çevresi sınırları.
     - Mifflin-St Jeor (1990) ve Harris-Benedict (1919) bazal metabolizma eşitlikleri; FAO/WHO/UNU PAL.
     - KDOQI 2020 (böbrek), ESPEN 2019 (karaciğer, yoğun bakım), ESPEN 2018/2022 (geriatri),
       NRS-2002 (Kondrup 2003), NICE CG32 (yeniden beslenme), ASPEN parenteral beslenme pratikleri.
   ========================================================================== */
(function (root, factory) {
  var M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M; else root.AXDIYET = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var r1 = function (v) { return Math.round(v * 10) / 10; };

  /* =========================== referans değerler =========================== */
  var PAL = [{ k: 1.4, t: 'Hareketsiz (1,4)' }, { k: 1.6, t: 'Hafif aktif (1,6)' }, { k: 1.8, t: 'Orta aktif (1,8)' }, { k: 2.0, t: 'Çok aktif (2,0)' }];
  var bmh = {
    mifflin: function (o) { return 10 * o.kg + 6.25 * o.cm - 5 * o.yas + (o.cins === 'E' ? 5 : -161); },
    harris: function (o) { return o.cins === 'E' ? 66.5 + 13.75 * o.kg + 5.003 * o.cm - 6.755 * o.yas : 655.1 + 9.563 * o.kg + 1.850 * o.cm - 4.676 * o.yas; }
  };
  var bki = function (kg, cm) { return kg / Math.pow(cm / 100, 2); };
  var BKI = [ /* WHO */
    { k: 'zayif', t: 'Zayıf (<18,5)', max: 18.5 }, { k: 'normal', t: 'Normal (18,5–24,9)', max: 25 }, { k: 'fazla', t: 'Hafif şişman / pre-obez (25–29,9)', max: 30 },
    { k: 'obez1', t: 'Obez sınıf I (30–34,9)', max: 35 }, { k: 'obez2', t: 'Obez sınıf II (35–39,9)', max: 40 }, { k: 'obez3', t: 'Obez sınıf III (≥40)', max: 999 }];
  var bkiSinif = function (v) { for (var i = 0; i < BKI.length; i++) if (v < BKI[i].max) return BKI[i].k; return 'obez3'; };
  var belRisk = function (cins, bel) { var a = cins === 'E' ? [94, 102] : [80, 88]; return bel >= a[1] ? 'cok' : bel >= a[0] ? 'artmis' : 'yok'; };   /* WHO */
  var bkoRisk = function (cins, oran) { return oran >= (cins === 'E' ? 0.90 : 0.85) ? 'var' : 'yok'; };
  /* yetişkin referans hedefleri (gün). EFSA DRV (TÜBER 2022'nin dayanağı) ve WHO. */
  var hedef = function (o) {
    var E = o.kcal, kadin = o.cins === 'K', yas = o.yas || 30;
    return {
      kcal: { min: E * 0.95, max: E * 1.05, t: 'Enerji', u: 'kcal' },
      pro: { min: Math.max(E * 0.10 / 4, (o.kg || 60) * 0.83), max: E * 0.20 / 4, t: 'Protein', u: 'g' },
      yag: { min: E * 0.20 / 9, max: E * 0.35 / 9, t: 'Yağ', u: 'g' },
      kh: { min: E * 0.45 / 4, max: E * 0.60 / 4, t: 'Karbonhidrat', u: 'g' },
      sat: { max: E * 0.10 / 9, t: 'Doymuş yağ', u: 'g' },
      lif: { min: 25, t: 'Lif', u: 'g' },
      na: { max: 2000, t: 'Sodyum', u: 'mg' },
      k: { min: 3500, t: 'Potasyum', u: 'mg' },
      ca: { min: yas < 25 ? 1000 : 950, t: 'Kalsiyum', u: 'mg' },
      fe: { min: kadin && yas < 50 ? 16 : 11, t: 'Demir', u: 'mg' },
      c: { min: kadin ? 95 : 110, t: 'C vitamini', u: 'mg' },
      fol: { min: 330, t: 'Folat', u: 'µg' },
      b12: { min: 4, t: 'B12', u: 'µg' },
      d: { min: 15, t: 'D vitamini', u: 'µg' }
    };
  };
  var NUT = ['kcal', 'pro', 'yag', 'kh', 'lif', 'seker', 'sat', 'ca', 'fe', 'mg', 'p', 'k', 'na', 'zn', 'c', 'fol', 'b12', 'a', 'd', 'kol'];

  /* =========================== besin tablosu ve analiz =========================== */
  var DB = { besin: [], tarif: [], by: {} };
  var load = function (AXDB) {
    DB.besin = AXDB.besin || []; DB.tarif = AXDB.tarif || []; DB.by = {};
    DB.besin.forEach(function (b) { DB.by[b.id] = b; });
    DB.tarif.forEach(function (t) {                                            /* tarif: bileşenlerden 1 porsiyonun değerleri */
      var n = {}, g = 0, bay = '';
      NUT.forEach(function (k) { n[k] = 0; });
      t.tarif.forEach(function (x) { var b = DB.by[x[0]]; g += x[1]; if (b.b && bay.indexOf(b.b) < 0) bay += b.b; NUT.forEach(function (k) { n[k] += (b.n[k] || 0) * x[1] / 100; }); });
      var per100 = {}; NUT.forEach(function (k) { per100[k] = n[k] / g * 100; });
      DB.by[t.id] = { id: t.id, ad: t.ad, kat: 'tarif', ol: [[t.ol[0][0], g]], b: bay, n: per100, tarif: t.tarif, src: 'Acadex tarifi (bileşenlerden hesaplandı)' };
    });
    return DB;
  };
  /* items: [{id, g}] → toplam besin ögeleri */
  var analiz = function (items) {
    var s = {}; NUT.forEach(function (k) { s[k] = 0; });
    var bay = {};
    (items || []).forEach(function (it) { var b = DB.by[it.id]; if (!b) return; NUT.forEach(function (k) { s[k] += (b.n[k] || 0) * it.g / 100; }); if (b.b) b.b.split('').forEach(function (c) { bay[c] = true; }); });
    s.e = { kh: s.kcal ? s.kh * 4 / s.kcal * 100 : 0, pro: s.kcal ? s.pro * 4 / s.kcal * 100 : 0, yag: s.kcal ? s.yag * 9 / s.kcal * 100 : 0, sat: s.kcal ? s.sat * 9 / s.kcal * 100 : 0 };
    s.tuz = s.na * 2.54 / 1000;
    s.bay = bay;
    return s;
  };
  var durum = function (v, h) { if (h.max != null && v > h.max) return 'ust'; if (h.min != null && v < h.min) return 'alt'; return 'ok'; };

  /* menü görevleri (tabak & menü) */
  var GOREV = [
    { id: 'g-kahvalti', t: 'Doyurucu kahvaltı', d: 'Tek öğün: 400–550 kcal, en az 20 g protein, en az 6 g lif, sodyum en çok 800 mg.', ogun: 'kahvalti', profil: 'kadin',
      kr: [['kcal', 400, 550], ['pro', 20, null], ['lif', 6, null], ['na', null, 800]] },
    { id: 'g-gunluk', t: 'Dengeli günlük menü', d: 'Hareketsiz yetişkin kadın için 1800 kcal (±%5). KH %45–60, yağ %20–35, protein %15–20 enerji; lif ≥25 g; sodyum ≤2000 mg.', ogun: 'gun', profil: 'kadin',
      kr: [['kcal', 1710, 1890], ['%kh', 45, 60], ['%yag', 20, 35], ['%pro', 15, 20], ['lif', 25, null], ['na', null, 2000]] },
    { id: 'g-dash', t: 'Hipertansiyon: DASH tarzı', d: '2000 kcal (±%5); sodyum ≤1500 mg, potasyum ≥3500 mg, kalsiyum ≥950 mg, doymuş yağ <%10 enerji.', ogun: 'gun', profil: 'erkek',
      kr: [['kcal', 1900, 2100], ['na', null, 1500], ['k', 3500, null], ['ca', 950, null], ['%sat', null, 10]] },
    { id: 'g-colyak', t: 'Çölyak: glutensiz gün', d: '2000 kcal (±%5); hiç gluten içeren besin yok; lif ≥25 g; demir ≥16 mg.', ogun: 'gun', profil: 'kadin',
      kr: [['kcal', 1900, 2100], ['!g', 0, 0], ['lif', 25, null], ['fe', 16, null]] },
    { id: 'g-demir', t: 'Demir eksikliğinde gün', d: 'Doğurganlık çağında kadın, 2000 kcal (±%5); demir ≥16 mg, C vitamini ≥95 mg, folat ≥330 µg.', ogun: 'gun', profil: 'kadin',
      kr: [['kcal', 1900, 2100], ['fe', 16, null], ['c', 95, null], ['fol', 330, null]] }
  ];
  var KR_T = { kcal: 'Enerji (kcal)', pro: 'Protein (g)', lif: 'Lif (g)', na: 'Sodyum (mg)', k: 'Potasyum (mg)', ca: 'Kalsiyum (mg)', fe: 'Demir (mg)', c: 'C vitamini (mg)', fol: 'Folat (µg)', '%kh': 'Karbonhidrat (% enerji)', '%yag': 'Yağ (% enerji)', '%pro': 'Protein (% enerji)', '%sat': 'Doymuş yağ (% enerji)', '!g': 'Gluten içeren besin' };
  var gorevPuan = function (g, s, items) {
    var rows = g.kr.map(function (k) {
      var v;
      if (k[0] === '!g') v = (items || []).filter(function (it) { var b = DB.by[it.id]; return b && b.b && /[gy]/.test(b.b); }).length;
      else if (k[0].charAt(0) === '%') v = s.e[k[0].slice(1)];
      else v = s[k[0]];
      var ok = (k[1] == null || v >= k[1] - 1e-9) && (k[2] == null || v <= k[2] + 1e-9);
      return { k: k[0], t: KR_T[k[0]], v: v, min: k[1], max: k[2], ok: ok };
    });
    var n = rows.filter(function (r) { return r.ok; }).length;
    return { rows: rows, puan: Math.round(n / rows.length * 100) };
  };

  /* =========================== antropometri hastaları =========================== */
  /* gerçek değerler; bel: WHO noktası (son kaburga ile iliak tepe arası orta nokta), gobek: göbek hizası ölçülürse */
  var AH = [
    { id: 'a-ali', ad: 'Ali', yas: 45, cins: 'E', cm: 176, kg: 92, bel: 104, gobek: 107, kalca: 106, pal: 1.4, oz: 'Masa başı çalışan muhasebeci; son iki yılda 8 kg almış.' },
    { id: 'a-ayse', ad: 'Ayşe', yas: 32, cins: 'K', cm: 164, kg: 61, bel: 74, gobek: 78, kalca: 98, pal: 1.6, oz: 'Haftada üç gün yürüyüş yapan öğretmen; kontrol için gelmiş.' },
    { id: 'a-mert', ad: 'Mert', yas: 21, cins: 'E', cm: 182, kg: 92, bel: 84, gobek: 86, kalca: 101, pal: 2.0, oz: 'Haftada altı gün antrenman yapan halterci; "BKİ\'m obez diyor" diye gelmiş.' },
    { id: 'a-zehra', ad: 'Zehra', yas: 26, cins: 'K', cm: 168, kg: 48, bel: 63, gobek: 66, kalca: 86, pal: 1.4, oz: 'Son altı ayda iştahsızlık ve 5 kg kayıp; sınav döneminde.' },
    { id: 'a-hakan', ad: 'Hakan', yas: 58, cins: 'E', cm: 171, kg: 80, bel: 103, gobek: 105, kalca: 99, pal: 1.4, oz: 'Hipertansiyon tanılı; "kilom normal sayılır" diyor.' },
    { id: 'a-fatma', ad: 'Fatma', yas: 66, cins: 'K', cm: 158, kg: 74, bel: 95, gobek: 98, kalca: 108, pal: 1.4, oz: 'Tip 2 diyabet tanılı emekli; dizlerinden şikâyetçi.' }
  ];
  var antroTruth = function (h) {
    var b = bki(h.kg, h.cm), m = bmh.mifflin(h), hb = bmh.harris(h);
    return { bki: r1(b), bkiS: bkiSinif(b), bel: belRisk(h.cins, h.bel), bko: Math.round(h.bel / h.kalca * 100) / 100, bkoS: bkoRisk(h.cins, h.bel / h.kalca), mifflin: Math.round(m), harris: Math.round(hb), tee: Math.round(m * h.pal) };
  };
  /* f: öğrencinin girdiği/seçtiği; olc: ölçüm kaydı {kg, cm, bel, belYer, kalca} */
  var antroPuan = function (h, olc, f) {
    var T = antroTruth(h), rows = [], p = 0;
    var add = function (k, t, ok, w, dogru) { rows.push({ k: k, t: t, ok: ok, dogru: dogru }); if (ok) p += w; };
    add('olc', 'Ölçümler (tartı, boy, bel, kalça)', !!(olc.kg && olc.cm && olc.bel && olc.kalca), 10, '');
    add('belYer', 'Bel ölçüm noktası', olc.belYer === 'who', 10, 'son kaburga ile iliak tepe arası orta nokta (WHO)');
    add('bki', 'BKİ', f.bki != null && Math.abs(f.bki - T.bki) <= 0.2, 15, String(T.bki).replace('.', ','));
    add('bkiS', 'BKİ sınıfı', f.bkiS === T.bkiS, 10, T.bkiS);
    add('belS', 'Bel çevresi riski', f.belS === T.bel, 10, T.bel);
    add('bko', 'Bel/kalça oranı', f.bko != null && Math.abs(f.bko - T.bko) <= 0.02, 10, String(T.bko).replace('.', ','));
    add('bmh', 'BMH (Mifflin-St Jeor)', f.bmh != null && Math.abs(f.bmh - T.mifflin) <= 20, 20, T.mifflin + ' kcal');
    add('tee', 'Günlük enerji (BMH × PAL)', f.tee != null && Math.abs(f.tee - T.tee) <= 50, 15, T.tee + ' kcal');
    return { rows: rows, puan: p, T: T };
  };

  /* =========================== klinik vakalar =========================== */
  /* lab: [ad, değer, birim, alt, üst] ; durum hesaplanır. presc: hedef aralıklar. */
  var KISIT = { na: 'Sodyum kısıtlı', k: 'Potasyum kısıtlı', p: 'Fosfor kısıtlı', sivi: 'Sıvı kısıtlı', gluten: 'Glutensiz', laktoz: 'Laktoz azaltılmış', prokisit: 'Protein kısıtlı', kh: 'KH kontrollü (öğünlere dağıtılmış)' };
  var ONERI = { ons: 'Oral nütrisyon desteği (ONS)', gece: 'Gece geç ara öğün', tiamin: 'Beslenme öncesi tiamin', demir: 'Demirden zengin + C vitaminiyle', dvit: 'D vitamini değerlendirmesi', sik: 'Az ve sık öğün', kilo: 'Haftada 0,5–1 kg kilo kaybı hedefi' };
  var AGIRLIK = { mevcut: 'Mevcut ağırlık', ideal: 'İdeal ağırlık (BKİ 22)', kuru: 'Kuru ağırlık (ödem/asit düşülmüş)', duzeltilmis: 'Düzeltilmiş ağırlık (obezite)' };
  var VK = [
    { id: 'v-dm', ad: 'Kemal', yas: 58, cins: 'E', cm: 172, kg: 92, baslik: 'Tip 2 diyabet ve obezite',
      oyku: '3 yıldır tip 2 diyabet; metformin kullanıyor. Masa başı iş, akşamları ekmek ve tatlı tüketimi fazla. Hedefi kilo vermek.',
      lab: [['Açlık kan şekeri', 168, 'mg/dL', 70, 99], ['HbA1c', 8.4, '%', 4, 5.6], ['LDL kolesterol', 162, 'mg/dL', 0, 129], ['Trigliserit', 210, 'mg/dL', 0, 149], ['HDL kolesterol', 36, 'mg/dL', 40, 999], ['Kreatinin', 0.9, 'mg/dL', 0.7, 1.2], ['eGFR', 88, 'mL/dk/1,73m²', 60, 999], ['Potasyum', 4.4, 'mmol/L', 3.5, 5.1]],
      ag: ['mevcut', 'duzeltilmis'], kcal: [1500, 1900], pro: [0.8, 1.3], kisit: { gerek: ['kh'], yasak: ['prokisit', 'k', 'p'] }, oneri: { gerek: ['kilo'] },
      oncelik: ['Enerji açığıyla kilo kaybı, KH dağılımı ve lif', 'Protein kısıtlaması', 'Potasyum kısıtlaması', 'Glutensiz diyet'], dogru: 0,
      not: 'Obez tip 2 diyabette ilk hedef günlük ~500 kcal enerji açığı ile %5–10 kilo kaybıdır; KH öğünlere dağıtılır, lif artırılır, doymuş yağ azaltılır. Böbrek işlevi normal olduğu için protein kısıtlanmaz.' },
    { id: 'v-kbh', ad: 'Nermin', yas: 64, cins: 'K', cm: 158, kg: 60, baslik: 'Kronik böbrek hastalığı, evre 4 (diyaliz öncesi)',
      oyku: 'Hipertansif nefropati; diyabeti yok. Diyalize girmiyor. Hafif yorgunluk, iştah azalmış değil. Ödem yok.',
      lab: [['Kreatinin', 2.4, 'mg/dL', 0.5, 1.1], ['eGFR', 22, 'mL/dk/1,73m²', 60, 999], ['Üre', 92, 'mg/dL', 17, 43], ['Potasyum', 5.6, 'mmol/L', 3.5, 5.1], ['Fosfor', 5.2, 'mg/dL', 2.5, 4.5], ['Sodyum', 138, 'mmol/L', 136, 145], ['Albümin', 3.8, 'g/dL', 3.5, 5.2], ['Hemoglobin', 10.1, 'g/dL', 12, 15.5]],
      ag: ['mevcut'], kcal: [1500, 2100], pro: [0.55, 0.6], kisit: { gerek: ['na', 'k', 'p', 'prokisit'], yasak: ['sivi'] }, oneri: { gerek: [] },
      oncelik: ['Düşük proteinli (0,55–0,6 g/kg), yeterli enerjili diyet; K ve P kontrolü', 'Yüksek proteinli diyet', 'Sıvı kısıtlaması', 'Glutensiz diyet'], dogru: 0,
      not: 'KDOQI 2020: diyabeti olmayan, diyaliz öncesi evre 3–5 hastada protein 0,55–0,6 g/kg/gün (yakın izlemde) ve enerji 25–35 kcal/kg. Potasyum ve fosfor yüksek olduğu için kısıtlanır. Ödem yokken sıvı kısıtlaması gerekmez.' },
    { id: 'v-hd', ad: 'Cem', yas: 50, cins: 'E', cm: 175, kg: 70, baslik: 'Hemodiyaliz hastası',
      oyku: 'Haftada üç kez hemodiyalize giriyor. Diyalizler arası 3 kg alıyor. Kuru ağırlığı 70 kg. "Böbrek hastası protein yememeli" diye eti bırakmış.',
      lab: [['Kreatinin', 8.9, 'mg/dL', 0.7, 1.2], ['Potasyum', 5.8, 'mmol/L', 3.5, 5.1], ['Fosfor', 6.4, 'mg/dL', 2.5, 4.5], ['Albümin', 3.3, 'g/dL', 3.5, 5.2], ['Sodyum', 137, 'mmol/L', 136, 145], ['Hemoglobin', 10.8, 'g/dL', 13.5, 17.5]],
      ag: ['kuru'], kcal: [1750, 2450], pro: [1.0, 1.2], kisit: { gerek: ['na', 'k', 'p', 'sivi'], yasak: ['prokisit'] }, oneri: { gerek: [] },
      oncelik: ['Yeterli protein (1,0–1,2 g/kg); K, P, Na ve sıvı kontrolü', 'Diyaliz öncesi gibi protein kısıtlaması', 'Yüksek potasyumlu meyve-sebze artışı', 'Sıvıyı serbest bırakmak'], dogru: 0,
      not: 'Diyalizde protein kaybı olur: KDOQI 2020 protein 1,0–1,2 g/kg/gün önerir; diyaliz öncesi kısıtlama burada yanlıştır. Ağırlık olarak kuru ağırlık kullanılır. Sıvı, potasyum, fosfor ve sodyum kontrol edilir; albümin düşüklüğü protein-enerji yetersizliği riskini gösterir.' },
    { id: 'v-colyak', ad: 'Elif', yas: 24, cins: 'K', cm: 165, kg: 49, baslik: 'Yeni tanı çölyak hastalığı',
      oyku: 'Şişkinlik, ishal ve halsizlik; doku transglutaminaz antikoru yüksek, biyopsiyle tanı konmuş. Son bir yılda 4 kg vermiş.',
      lab: [['Anti-tTG IgA', 128, 'U/mL', 0, 10], ['Hemoglobin', 10.4, 'g/dL', 12, 15.5], ['Ferritin', 6, 'ng/mL', 15, 150], ['MCV', 74, 'fL', 80, 100], ['Folat', 2.8, 'ng/mL', 3.9, 26.8], ['B12', 310, 'pg/mL', 200, 900], ['Albümin', 4.0, 'g/dL', 3.5, 5.2], ['D vitamini (25-OH)', 14, 'ng/mL', 30, 100]],
      ag: ['mevcut'], kcal: [1700, 2100], pro: [0.9, 1.3], kisit: { gerek: ['gluten'], yasak: ['prokisit'] }, oneri: { gerek: ['demir', 'dvit'] },
      oncelik: ['Ömür boyu sıkı glutensiz diyet; demir, folat ve D vitamini açığının giderilmesi', 'Yalnızca buğdayı kesmek, arpa ve çavdar serbest', 'Protein kısıtlaması', 'Sodyum kısıtlaması'], dogru: 0,
      not: 'Tedavi ömür boyu glutensiz diyettir (buğday, arpa, çavdar; yulaf yalnızca glutensiz sertifikalıysa). Demir eksikliği anemisi, folat ve D vitamini düşüklüğü emilim bozukluğunun bulgusudur. BKİ 18 olduğu için enerji, günlük harcamanın (Mifflin × 1,4 ≈ 1740 kcal) 200–400 kcal üstünde tutularak kilo kazanımı desteklenir.' },
    { id: 'v-siroz', ad: 'Hasan', yas: 61, cins: 'E', cm: 174, kg: 81, baslik: 'Alkole bağlı karaciğer sirozu, asit',
      oyku: 'Asit nedeniyle karın şişliği var; doktoru orta derecede asit için kuru ağırlığı yaklaşık 73 kg tahmin ediyor. Kas kaybı belirgin. "Karaciğer hastasıyım, proteini kestim" diyor.',
      lab: [['Albümin', 2.8, 'g/dL', 3.5, 5.2], ['Total bilirubin', 2.6, 'mg/dL', 0.3, 1.2], ['INR', 1.5, '', 0.8, 1.2], ['Sodyum', 133, 'mmol/L', 136, 145], ['Trombosit', 92, '×10³/µL', 150, 400], ['Amonyak', 58, 'µmol/L', 11, 51]],
      ag: ['kuru'], kcal: [2400, 2700], pro: [1.2, 1.5], kisit: { gerek: ['na'], yasak: ['prokisit', 'sivi'] }, oneri: { gerek: ['gece', 'sik', 'tiamin'] },
      oncelik: ['Yeterli enerji (≈35 kcal/kg) ve protein (1,2–1,5 g/kg), gece ara öğünü, sodyum kısıtlaması', 'Protein kısıtlaması (ensefalopati riski)', 'Sıvı kısıtlaması', 'Glutensiz diyet'], dogru: 0,
      not: 'ESPEN 2019: sirozda enerji ≈35 kcal/kg, protein 1,2–1,5 g/kg; protein kısıtlaması sarkopeniyi kötüleştirir, ensefalopatide bile önerilmez. Asitte hesap kuru ağırlıkla yapılır ve sodyum kısıtlanır. Sıvı kısıtlaması yalnızca belirgin hiponatremide (<125 mmol/L) düşünülür. Alkol kullanımı nedeniyle tiamin verilir; uzun açlığı önlemek için gece geç ara öğün eklenir.' },
    { id: 'v-yasli', ad: 'Fatma', yas: 82, cins: 'K', cm: 156, kg: 50, baslik: 'Kalça kırığı sonrası yaşlı hasta',
      oyku: 'Kalça kırığı ameliyatı sonrası 3. gün. Son 2 ayda 55 kg\'dan 50 kg\'a düşmüş. Son bir haftadır gereksiniminin yaklaşık yarısını yiyor.',
      lab: [['Albümin', 3.1, 'g/dL', 3.5, 5.2], ['CRP', 18, 'mg/L', 0, 5], ['Lenfosit', 1100, '/µL', 1500, 4000], ['D vitamini (25-OH)', 14, 'ng/mL', 30, 100], ['Hemoglobin', 11.2, 'g/dL', 12, 15.5], ['Potasyum', 3.9, 'mmol/L', 3.5, 5.1]],
      nrs: { durum: 2, siddet: 1, yas: 1 },
      ag: ['mevcut'], kcal: [1400, 1600], pro: [1.0, 1.5], kisit: { gerek: [], yasak: ['prokisit', 'na'] }, oneri: { gerek: ['ons', 'dvit'] },
      oncelik: ['Malnütrisyon riski: 30 kcal/kg, ≥1 g/kg protein ve oral nütrisyon desteği', 'Kilo kaybı için enerji kısıtlaması', 'Sodyum kısıtlaması', 'Yalnızca albümin düzelene kadar beklemek'], dogru: 0,
      not: 'NRS-2002: 2 ayda %9 kayıp ve alımın yarıya inmesi (2) + kalça kırığı (1) + 70 yaş üstü (1) = 4 → beslenme riski var. ESPEN geriatri: 30 kcal/kg, en az 1 g/kg protein ve ONS. Albümin akut fazda (CRP yüksek) düşer; tek başına beslenme göstergesi değildir.' },
    { id: 'v-gdm', ad: 'Zeynep', yas: 31, cins: 'K', cm: 163, kg: 68, baslik: 'Gebelik diyabeti (28. hafta)',
      oyku: 'Gebelik öncesi 60 kg. 24–28. hafta OGTT\'de gebelik diyabeti tanısı. Ekmeği tamamen bırakmayı düşünüyor.',
      lab: [['OGTT açlık', 98, 'mg/dL', 0, 91], ['OGTT 1. saat', 192, 'mg/dL', 0, 179], ['OGTT 2. saat', 158, 'mg/dL', 0, 152], ['Hemoglobin', 11.4, 'g/dL', 11, 14], ['Ferritin', 18, 'ng/mL', 15, 150]],
      ag: ['mevcut'], kcal: [1950, 2450], pro: [1.1, 1.5], kisit: { gerek: ['kh'], yasak: ['prokisit'] }, oneri: { gerek: ['sik'] },
      oncelik: ['KH\'yi kesmeden (en az 175 g/gün) 3 ana + 2–3 ara öğüne dağıtmak', 'Karbonhidratı tamamen kesmek', 'Kilo vermek için enerji kısıtlamak', 'Protein kısıtlaması'], dogru: 0,
      not: 'Gebelik diyabetinde KH kesilmez: en az 175 g/gün KH, 3 ana ve 2–3 ara öğüne dağıtılır, posalı kaynaklar seçilir. Gebelikte kilo verme hedeflenmez. (IADPSG eşikleri: açlık ≥92, 1. saat ≥180, 2. saat ≥153 mg/dL.)' }
  ];
  var labDurum = function (l) { return l[1] < l[3] ? 'L' : l[1] > l[4] ? 'H' : 'N'; };
  var idealKg = function (cm) { return 22 * Math.pow(cm / 100, 2); };
  var duzKg = function (v) { var i = idealKg(v.cm); return i + 0.25 * (v.kg - i); };
  var agirlik = function (v, tip) { if (tip === 'ideal') return idealKg(v.cm); if (tip === 'duzeltilmis') return duzKg(v); if (tip === 'kuru') return v.id === 'v-siroz' ? 73 : v.id === 'v-hd' ? 70 : v.kg; return v.kg; };
  /* f: {flags:{i:true}, nrs:{durum,siddet,yas}, ag, kcal, pro (g/gün), kisit:{k:true}, oneri:{k:true}, oncelik} */
  var vakaPuan = function (v, f) {
    var rows = [], p = 0, tot = 0, add = function (t, ok, w, dogru) { rows.push({ t: t, ok: ok, dogru: dogru }); tot += w; if (ok) p += w; };
    var abn = v.lab.map(function (l, i) { return labDurum(l) !== 'N' ? i : -1; }).filter(function (i) { return i >= 0; });
    var fl = f.flags || {}, hit = abn.filter(function (i) { return fl[i]; }).length, fp = Object.keys(fl).filter(function (i) { return fl[i] && abn.indexOf(+i) < 0; }).length;
    add('Anormal laboratuvar değerleri (' + hit + '/' + abn.length + (fp ? ', ' + fp + ' fazladan' : '') + ')', hit === abn.length && fp === 0, 15, v.lab.filter(function (l) { return labDurum(l) !== 'N'; }).map(function (l) { return l[0]; }).join(', '));
    if (v.nrs) { var n = v.nrs, tot2 = n.durum + n.siddet + n.yas, s = f.nrs || {}; add('NRS-2002 puanı', (+s.durum + +s.siddet + +s.yas) === tot2 && +s.durum === n.durum && +s.siddet === n.siddet && +s.yas === n.yas, 10, tot2 + ' (durum ' + n.durum + ' + şiddet ' + n.siddet + ' + yaş ' + n.yas + ')'); }
    add('Hesapta kullanılan ağırlık', v.ag.indexOf(f.ag) >= 0, 10, v.ag.map(function (a) { return AGIRLIK[a]; }).join(' ya da '));
    add('Enerji (kcal/gün)', f.kcal >= v.kcal[0] && f.kcal <= v.kcal[1], 15, v.kcal[0] + '–' + v.kcal[1] + ' kcal');
    var w = agirlik(v, v.ag[0]), pk = f.pro / w;
    add('Protein (g/kg)', pk >= v.pro[0] - 0.05 && pk <= v.pro[1] + 0.05, 15, String(v.pro[0]).replace('.', ',') + '–' + String(v.pro[1]).replace('.', ',') + ' g/kg (' + Math.round(v.pro[0] * w) + '–' + Math.round(v.pro[1] * w) + ' g)');
    var ks = f.kisit || {}, miss = v.kisit.gerek.filter(function (k) { return !ks[k]; }), bad = v.kisit.yasak.filter(function (k) { return ks[k]; });
    add('Kısıtlamalar', !miss.length && !bad.length, 15, (v.kisit.gerek.map(function (k) { return KISIT[k]; }).join(', ') || 'özel kısıtlama yok') + (bad.length ? ' · yanlış: ' + bad.map(function (k) { return KISIT[k]; }).join(', ') : ''));
    var on = f.oneri || {}, om = v.oneri.gerek.filter(function (k) { return !on[k]; });
    add('Öneriler', !om.length, 10, v.oneri.gerek.map(function (k) { return ONERI[k]; }).join(', ') || '—');
    add('Öncelikli hedef', f.oncelik === v.dogru, 10, v.oncelik[v.dogru]);
    return { rows: rows, puan: Math.round(p / tot * 100), abn: abn };
  };
  /* NRS-2002 (Kondrup 2003) yardımcı açıklamaları */
  var NRS = {
    durum: ['0 · normal beslenme durumu', '1 · 3 ayda >%5 kayıp ya da alım gereksinimin %50–75\'i', '2 · 2 ayda >%5 kayıp ya da BKİ 18,5–20,5 + genel durum bozuk ya da alım %25–60', '3 · 1 ayda >%5 kayıp (3 ayda >%15) ya da BKİ <18,5 + genel durum bozuk ya da alım %0–25'],
    siddet: ['0 · normal gereksinim', '1 · kalça kırığı, akut komplikasyonlu kronik hastalık, hemodiyaliz, diyabet, kanser', '2 · büyük karın cerrahisi, inme, ağır pnömoni, hematolojik kanser', '3 · kafa travması, kemik iliği nakli, yoğun bakım (APACHE >10)'],
    yas: ['0 · 70 yaş altı', '1 · 70 yaş ve üstü']
  };

  /* =========================== enteral ve parenteral =========================== */
  var URUN = [ /* jenerik ürün tipleri: kcal/ml, protein g/L */
    { id: 'std', t: 'Standart (1,0 kcal/ml)', kcal: 1.0, pro: 40, d: 'Polimerik, lifsiz' },
    { id: 'lif', t: 'Standart lifli (1,0 kcal/ml)', kcal: 1.0, pro: 40, d: 'Karışık lif 15 g/L' },
    { id: 'yp', t: 'Yüksek proteinli (1,25 kcal/ml)', kcal: 1.25, pro: 63, d: 'Proteinden gelen enerji ≈ %20' },
    { id: 'ye', t: 'Yüksek enerjili (1,5 kcal/ml)', kcal: 1.5, pro: 60, d: 'Sıvı kısıtlamasında' },
    { id: 'dm', t: 'Diyabete özgü (1,0 kcal/ml)', kcal: 1.0, pro: 43, d: 'Düşük KH, yüksek MUFA, lifli' },
    { id: 'renal', t: 'Renal (2,0 kcal/ml)', kcal: 2.0, pro: 70, d: 'Düşük K, P ve hacim' },
    { id: 'pep', t: 'Peptit bazlı (1,0 kcal/ml)', kcal: 1.0, pro: 40, d: 'Malabsorpsiyonda' }
  ];
  var TPN = { dex: { kcal: 3.4, osm: 5 }, aa: { kcal: 4, osm: 10 }, lip20: { kcalMl: 2.0, gMl: 0.2 } };
  /* x: {dexPct, dexMl, aaPct, aaMl, lipMl, kg} */
  var tpnHesap = function (x) {
    var dg = x.dexMl * x.dexPct / 100, ag = x.aaMl * x.aaPct / 100, lg = x.lipMl * TPN.lip20.gMl, vol = x.dexMl + x.aaMl + x.lipMl;
    var kD = dg * TPN.dex.kcal, kA = ag * TPN.aa.kcal, kL = x.lipMl * TPN.lip20.kcalMl;
    var osm = vol ? (dg * TPN.dex.osm + ag * TPN.aa.osm + x.lipMl * 0.26) / (vol / 1000) : 0;   /* %20 lipid ≈ 260-350 mOsm/L */
    return { dexG: r1(dg), aaG: r1(ag), lipG: r1(lg), vol: Math.round(vol), kcal: Math.round(kD + kA + kL), npk: Math.round(kD + kL), kD: Math.round(kD), kA: Math.round(kA), kL: Math.round(kL),
      gir: x.kg ? r1(dg * 1000 / (x.kg * 1440)) : 0, lipKg: x.kg ? Math.round(lg / x.kg * 100) / 100 : 0, osm: Math.round(osm), hiz: r1(vol / 24) };
  };
  var EP = [
    { id: 'e-inme', tip: 'enteral', ad: 'Osman', yas: 72, cins: 'E', cm: 175, kg: 80, baslik: 'Yoğun bakımda inme, nazogastrik tüp',
      oyku: 'İskemik inme sonrası yutma bozukluğu; 2. gün, hemodinamisi stabil. Diyabeti ve böbrek sorunu yok. Enteral beslenme 24 saat sürekli pompayla verilecek.',
      kcal: [1800, 2200], pro: [1.2, 1.5], urun: ['yp', 'lif', 'std'], saat: 24,
      not: 'ESPEN 2019 (yoğun bakım): dolaylı kalorimetri yoksa ~20–25 kcal/kg, protein ≈1,3 g/kg; akut evrede hedefe 3–7 günde kademeli ulaşılır (başlangıç 10–20 ml/saat). Standart ürünle hedef enerjiye ulaşınca protein yetersiz kalır: yüksek proteinli ürün ya da protein modülü gerekir. Diyare yönetiminde lifli ürün yararlı olabilir.' },
    { id: 'e-kbs', tip: 'tpn', ad: 'Leyla', yas: 45, cins: 'K', cm: 165, kg: 60, baslik: 'Kısa bağırsak sendromu, santral kateter',
      oyku: 'Geniş ince bağırsak rezeksiyonu sonrası; enteral yolla yeterli beslenemiyor. Santral venöz kateteri var. Hedef: 25 kcal/kg, 1,5 g/kg protein. Lipid ≤1 g/kg, glukoz infüzyon hızı ≤4 mg/kg/dk olsun.',
      kcal: [1350, 1650], pro: [1.35, 1.65], lipMax: 1.0, girMax: 4, santral: true,
      not: 'Toplam enerji = dekstroz (3,4 kcal/g) + amino asit (4 kcal/g) + %20 lipid (2,0 kcal/ml). Glukoz infüzyon hızı = dekstroz g × 1000 / (kg × 1440) mg/kg/dk; yüksek hız hiperglisemi ve karaciğer yağlanması riskidir. Lipid ≤1 g/kg/gün tutulur. Santral yolda ozmolarite sınırı yoktur; periferik yolda ≈900 mOsm/L üstüne çıkılmaz.' },
    { id: 'e-refeed', tip: 'refeed', ad: 'Defne', yas: 19, cins: 'K', cm: 165, kg: 37, baslik: 'Anoreksiya nervoza, yeniden beslenme riski',
      oyku: 'Son 20 gündür neredeyse hiç yemek yemiyor. BKİ 13,6. Beslenmeye başlanacak.',
      lab: [['Potasyum', 3.1, 'mmol/L', 3.5, 5.1], ['Fosfor', 2.0, 'mg/dL', 2.5, 4.5], ['Magnezyum', 1.5, 'mg/dL', 1.7, 2.4]],
      kcalKg: [4, 10], gerek: ['tiamin', 'elektrolit', 'kademeli'],
      not: 'NICE CG32: BKİ <16, >10–15 gün çok az alım ve düşük K/P/Mg yüksek risktir; en çok 10 kcal/kg/gün ile başlanır, aşırı durumda (BKİ <14 ya da >15 gün açlık) 5 kcal/kg düşünülür. Beslenmeden önce ve ilk 10 gün tiamin, elektrolit replasmanı ve yakın izlem; enerji 4–7 günde kademeli artırılır.' }
  ];
  var REFEED = { tiamin: 'Beslenme öncesi tiamin ve B vitaminleri', elektrolit: 'K, P, Mg replasmanı ve günlük izlem', kademeli: 'Enerjiyi 4–7 günde kademeli artırmak', hizli: 'İlk gün tam gereksinimle başlamak' };
  /* f enteral: {kcal, pro (g), urun, ml, hiz, modul (g protein)} */
  var epPuan = function (c, f) {
    var rows = [], p = 0, tot = 0, add = function (t, ok, w, d) { rows.push({ t: t, ok: ok, dogru: d }); tot += w; if (ok) p += w; };
    if (c.tip === 'enteral') {
      var u = URUN.filter(function (x) { return x.id === f.urun; })[0];
      add('Hedef enerji', f.kcal >= c.kcal[0] && f.kcal <= c.kcal[1], 15, c.kcal[0] + '–' + c.kcal[1] + ' kcal');
      add('Hedef protein', f.pro / c.kg >= c.pro[0] - 0.05 && f.pro / c.kg <= c.pro[1] + 0.05, 15, Math.round(c.pro[0] * c.kg) + '–' + Math.round(c.pro[1] * c.kg) + ' g');
      add('Ürün seçimi', c.urun.indexOf(f.urun) >= 0, 15, c.urun.map(function (k) { return URUN.filter(function (x) { return x.id === k; })[0].t; }).join(', '));
      var ml = u ? Math.round(f.kcal / u.kcal) : 0;
      add('Günlük hacim', u && Math.abs(f.ml - ml) <= 25, 15, ml + ' ml');
      add('Pompa hızı (ml/saat)', u && Math.abs(f.hiz - f.ml / c.saat) <= 2, 15, f.ml ? r1(f.ml / c.saat) + ' ml/saat' : '—');
      var verilen = u ? f.ml * u.pro / 1000 + (+f.modul || 0) : 0;
      add('Protein karşılanıyor mu', verilen >= c.pro[0] * c.kg - 2, 25, 'ürün + modül ≥ ' + Math.round(c.pro[0] * c.kg) + ' g (senin: ' + Math.round(verilen) + ' g)');
    } else if (c.tip === 'tpn') {
      var h = tpnHesap({ dexPct: f.dexPct, dexMl: f.dexMl, aaPct: f.aaPct, aaMl: f.aaMl, lipMl: f.lipMl, kg: c.kg });
      add('Toplam enerji', h.kcal >= c.kcal[0] && h.kcal <= c.kcal[1], 25, c.kcal[0] + '–' + c.kcal[1] + ' kcal (senin: ' + h.kcal + ')');
      add('Amino asit', h.aaG / c.kg >= c.pro[0] && h.aaG / c.kg <= c.pro[1], 25, Math.round(c.pro[0] * c.kg) + '–' + Math.round(c.pro[1] * c.kg) + ' g (senin: ' + h.aaG + ')');
      add('Lipid ≤ ' + c.lipMax + ' g/kg', h.lipKg > 0 && h.lipKg <= c.lipMax + 1e-9, 20, 'senin: ' + String(h.lipKg).replace('.', ',') + ' g/kg');
      add('Glukoz infüzyon hızı ≤ ' + c.girMax, h.gir > 0 && h.gir <= c.girMax + 1e-9, 20, 'senin: ' + String(h.gir).replace('.', ',') + ' mg/kg/dk');
      add('Saatlik hız', Math.abs((+f.hiz || 0) - h.hiz) <= 2, 10, String(h.hiz).replace('.', ',') + ' ml/saat');
    } else {
      var kk = f.kcal / c.kg;
      add('Başlangıç enerjisi (kcal/kg)', kk >= c.kcalKg[0] && kk <= c.kcalKg[1], 40, '≤10 kcal/kg (aşırı riskte ≈5): ' + Math.round(c.kcalKg[0] * c.kg) + '–' + Math.round(c.kcalKg[1] * c.kg) + ' kcal');
      var g = f.gerek || {}, miss = c.gerek.filter(function (k) { return !g[k]; });
      add('Önlemler', !miss.length && !g.hizli, 60, c.gerek.map(function (k) { return REFEED[k]; }).join(', '));
    }
    return { rows: rows, puan: Math.round(p / tot * 100) };
  };

  return { PAL: PAL, bmh: bmh, bki: bki, BKI: BKI, bkiSinif: bkiSinif, belRisk: belRisk, bkoRisk: bkoRisk, hedef: hedef, NUT: NUT,
    DB: DB, load: load, analiz: analiz, durum: durum, GOREV: GOREV, KR_T: KR_T, gorevPuan: gorevPuan,
    AH: AH, antroTruth: antroTruth, antroPuan: antroPuan,
    VK: VK, KISIT: KISIT, ONERI: ONERI, AGIRLIK: AGIRLIK, labDurum: labDurum, idealKg: idealKg, duzKg: duzKg, agirlik: agirlik, vakaPuan: vakaPuan, NRS: NRS,
    URUN: URUN, TPN: TPN, tpnHesap: tpnHesap, EP: EP, REFEED: REFEED, epPuan: epPuan };
});
