/* ==========================================================================
   ACADEX HEMŞİRELİK LAB · veri (labs/hemsirelik/hem-veri.js), 01.11.2026
   Hasta başı (vital + NEWS2 + hemşirelik süreci), beceri istasyonları, ilaç
   uygulama (doğru ilkeleri, damla ve pompa hızı), servis vardiyası (öncelik,
   olaylar, SBAR) ve Acadex Medica vaka dosyaları. Saf veri + saf hesap.
   EĞİTİM AMAÇLIDIR; hastalar kurgusaldır. Kaynaklar: Royal College of
   Physicians NEWS2 (2017); NANDA-I tanı dili (sadeleştirilmiş); CDC/WHO el
   hijyeni ve aseptik teknik ilkeleri; ADA hipoglisemi 15-15 kuralı; INS
   infüzyon uygulama standartları (genel ilkeler).
   ========================================================================== */
(function (root, factory) {
  var V = factory();
  if (typeof module === 'object' && module.exports) module.exports = V;
  if (root) root.AXHEM = V;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';
  var V = {};
  V.rng = function (t) { var s = (t >>> 0) || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

  /* =========================== NEWS2 (RCP 2017) =========================== */
  V.NEWS_PARAM = [
    { id: 'sol', ad: 'Solunum sayısı', birim: '/dk' }, { id: 'spo2', ad: 'SpO₂ (ölçek 1)', birim: '%' }, { id: 'o2', ad: 'Oksijen desteği', birim: '' },
    { id: 'sis', ad: 'Sistolik kan basıncı', birim: 'mmHg' }, { id: 'nabiz', ad: 'Nabız', birim: '/dk' }, { id: 'bilinc', ad: 'Bilinç (ACVPU)', birim: '' }, { id: 'ates', ad: 'Vücut sıcaklığı', birim: '°C' }
  ];
  V.newsSkor = {
    sol: function (x) { return x <= 8 ? 3 : x <= 11 ? 1 : x <= 20 ? 0 : x <= 24 ? 2 : 3; },
    spo2: function (x) { return x <= 91 ? 3 : x <= 93 ? 2 : x <= 95 ? 1 : 0; },
    o2: function (x) { return x ? 2 : 0; },
    sis: function (x) { return x <= 90 ? 3 : x <= 100 ? 2 : x <= 110 ? 1 : x <= 219 ? 0 : 3; },
    nabiz: function (x) { return x <= 40 ? 3 : x <= 50 ? 1 : x <= 90 ? 0 : x <= 110 ? 1 : x <= 130 ? 2 : 3; },
    bilinc: function (x) { return x === 'A' ? 0 : 3; },
    ates: function (x) { return x <= 35 ? 3 : x <= 36 ? 1 : x <= 38 ? 0 : x <= 39 ? 1 : 2; }
  };
  /* v: {sol, spo2, o2, sis, nabiz, bilinc, ates} → {toplam, parca, uc (tek parametrede 3), yanit} */
  V.news = function (v) {
    var p = {}, t = 0, uc = false;
    V.NEWS_PARAM.forEach(function (x) { p[x.id] = V.newsSkor[x.id](v[x.id]); t += p[x.id]; if (p[x.id] === 3) uc = true; });
    var y = t >= 7 ? 'yuksek' : t >= 5 ? 'orta' : uc ? 'tek3' : t >= 1 ? 'dusuk' : 'sifir';
    return { toplam: t, parca: p, uc: uc, yanit: y };
  };
  V.YANIT = {
    sifir: { ad: 'Skor 0', izlem: 'En az 12 saatte bir izlem', is: 'Rutin izleme devam' },
    dusuk: { ad: 'Skor 1–4 (düşük)', izlem: 'En az 4–6 saatte bir izlem', is: 'Hemşire değerlendirir; izlem sıklığını ve müdahaleyi belirler' },
    tek3: { ad: 'Tek parametrede 3', izlem: 'En az saatte bir izlem', is: 'Sorumlu hekime acil haber; servis içi acil değerlendirme' },
    orta: { ad: 'Skor 5–6 (orta)', izlem: 'En az saatte bir izlem', is: 'Acil yanıt: hekime hemen haber, değerlendirme ve tedavi planı' },
    yuksek: { ad: 'Skor ≥7 (yüksek)', izlem: 'Sürekli izlem', is: 'Acil müdahale ekibi (hızlı yanıt / yoğun bakım) çağrılır' }
  };
  V.ACVPU = [['A', 'Uyanık (Alert)'], ['C', 'Yeni gelişen konfüzyon (Confusion)'], ['V', 'Sese yanıt (Voice)'], ['P', 'Ağrıya yanıt (Pain)'], ['U', 'Yanıtsız (Unresponsive)']];

  /* kişisel çeşitlilik: aynı yaş grubunda başka ad */
  var AD = { E: { orta: ['Murat', 'Serkan', 'Hakan', 'Kemal', 'Levent'], yasli: ['Ahmet', 'Mehmet', 'Hasan', 'Yusuf', 'Ali', 'Rıza', 'Cemal'] }, K: { orta: ['Ayşe', 'Gül', 'Sevda', 'Esra', 'Derya'], yasli: ['Fatma', 'Emine', 'Hatice', 'Zehra', 'Nuriye', 'Saadet', 'Gülsüm'] } };
  V.kisi = function (h, r) { var g = h.yas < 60 ? 'orta' : 'yasli', L = AD[h.cins][g], ad = L[Math.floor(r() * L.length)]; return { ad: ad, hitap: ad + (h.cins === 'K' ? ' Hanım' : ' Bey'), yas: h.yas + Math.round((r() * 2 - 1) * 2) }; };
  /* vital sapması: klinik tabloyu bozmadan küçük oynama (NEWS her seferinde yeniden hesaplanır) */
  V.oynat = function (v, r) {
    var j = function (x, d) { return Math.round(x + (r() * 2 - 1) * d); };
    return { sol: j(v.sol, 1), spo2: Math.min(100, j(v.spo2, 1)), o2: v.o2, sis: j(v.sis, 4), dia: j(v.dia, 3), nabiz: j(v.nabiz, 3), bilinc: v.bilinc, ates: Math.round((v.ates + (r() * 2 - 1) * 0.2) * 10) / 10 };
  };

  /* =========================== hasta başı =========================== */
  var H = function (o) { return o; };
  V.HASTA = [
    H({ id: 'pnomoni', cins: 'E', yas: 74, tani: 'Toplum kökenli pnömoni, 2. gün', durum: 'Nefes darlığı artmış, öksürüyor; burundan 2 L/dk oksijen alıyor.', bilincT: 'Gözleri açık, sorulara yerinde yanıt veriyor.',
      v: { sol: 24, spo2: 92, o2: true, sis: 104, dia: 62, nabiz: 112, bilinc: 'A', ates: 38.6 },
      tanilar: [['Gaz değişiminde bozulma', true], ['Etkisiz baş etme', false], ['Kabızlık', false]], hedef: 'SpO₂ istem aralığında, solunum sayısı ve eforu azalmış olacak.',
      girisim: [['Yarı oturur (Fowler) pozisyon ver', true], ['İstemdeki oksijeni sürdür, SpO₂’yi sürekli izle', true], ['Skoru bildir: hekime ve acil müdahale ekibine haber ver', true], ['Sıvı alımını ve idrar çıkışını izle', true], ['Rahat uyusun diye düz yatır, oksijeni kapat', false]] }),
    H({ id: 'postop', cins: 'K', yas: 58, tani: 'Laparoskopik kolesistektomi, ameliyat sonrası 1. gün', durum: 'Karın ağrısını 7/10 olarak tanımlıyor; öksürmekten kaçınıyor.', bilincT: 'Uyanık, yönelimi tam.',
      v: { sol: 18, spo2: 97, o2: false, sis: 128, dia: 76, nabiz: 88, bilinc: 'A', ates: 37.4 },
      tanilar: [['Akut ağrı (cerrahi girişime bağlı)', true], ['Gaz değişiminde bozulma', false], ['Sıvı volüm fazlalığı', false]], hedef: 'Ağrı puanı 3/10’un altına inecek; derin solunum ve mobilizasyon yapabilecek.',
      girisim: [['Ağrıyı sayısal ölçekle değerlendir', true], ['İstemdeki analjeziği uygula, 30–60 dk sonra yeniden değerlendir', true], ['Öksürürken yastıkla karnı desteklemeyi öğret', true], ['Erken mobilizasyonu destekle', true], ['Ağrı kesiciyi “alışkanlık yapmasın” diye geciktir', false]] }),
    H({ id: 'sepsis', cins: 'K', yas: 67, tani: 'İdrar yolu enfeksiyonu', durum: 'Kızı “bu sabah annem beni tanımadı” diyor; titriyor, idrarı azalmış.', bilincT: 'Gözleri açık ama yeri ve zamanı karıştırıyor; bu yeni gelişmiş.',
      v: { sol: 22, spo2: 95, o2: false, sis: 92, dia: 54, nabiz: 118, bilinc: 'C', ates: 39.3 },
      tanilar: [['Şok riski (enfeksiyona bağlı)', true], ['Bilgi eksikliği', false], ['Uyku örüntüsünde bozulma', false]], hedef: 'Vital bulgular stabilleşecek, idrar çıkışı ≥0,5 ml/kg/saat olacak.',
      girisim: [['Hekime ve acil müdahale ekibine hemen haber ver', true], ['İstemle kan kültürü, laktat ve sıvı tedavisini hızla başlat', true], ['İdrar çıkışını saatlik izle', true], ['Vitalleri sık aralıklarla ölç', true], ['Ateşi düşsün diye yalnız soğuk havlu koy ve beklemeye al', false]] }),
    H({ id: 'hipo', cins: 'E', yas: 62, tani: 'Tip 2 diyabet, insülin tedavisi', durum: 'Kahvaltısını yemedi; terliyor, elleri titriyor. Parmak ucu kan şekeri 54 mg/dL.', bilincT: 'Uyanık, yanıtları biraz yavaş ama yerinde.',
      v: { sol: 16, spo2: 98, o2: false, sis: 136, dia: 82, nabiz: 96, bilinc: 'A', ates: 36.6 },
      tanilar: [['Kan şekeri düzeyinde dengesizlik (hipoglisemi)', true], ['Akut ağrı', false], ['Hipertermi', false]], hedef: 'Kan şekeri 15 dakikada 70 mg/dL üzerine çıkacak; belirtiler geçecek.',
      girisim: [['15 g hızlı etkili karbonhidrat ver (bilinci açık, yutabiliyor)', true], ['15 dakika sonra kan şekerini yeniden ölç', true], ['Hekime bildir; insülin ve öğün zamanlamasını birlikte değerlendir', true], ['Yeniden düşmemesi için ara öğün planla', true], ['Bir sonraki insülini her zamanki gibi uygula', false]] }),
    H({ id: 'dusme', cins: 'K', yas: 81, tani: 'Kalça kırığı, ameliyat bekliyor', durum: 'Gece tek başına tuvalete kalkmaya çalışmış; görmesi zayıf, idrara sık çıkıyor.', bilincT: 'Uyanık, yönelimi tam.',
      v: { sol: 18, spo2: 94, o2: false, sis: 150, dia: 88, nabiz: 84, bilinc: 'A', ates: 36.2 },
      tanilar: [['Düşme riski', true], ['Gaz değişiminde bozulma', false], ['Sıvı volüm eksikliği', false]], hedef: 'Yatışı boyunca düşmeyecek.',
      girisim: [['Yatağı en alçak konuma getir, frenleri kilitle', true], ['Zili ve gözlüğü elinin altına koy', true], ['Düzenli tuvalet planı yap, gece ışığı aç', true], ['Kaymaz çorap giydir; düşme riski skorunu kaydet', true], ['Kalkmasın diye bileklerinden yatağa bağla', false]] }),
    H({ id: 'kky', cins: 'E', yas: 76, tani: 'Kalp yetmezliği alevlenmesi', durum: 'Bacaklarında ödem var; dün geceye göre 2 kg almış; yatarken nefesi daralıyor.', bilincT: 'Uyanık, yönelimi tam.',
      v: { sol: 22, spo2: 93, o2: false, sis: 142, dia: 90, nabiz: 98, bilinc: 'A', ates: 36.8 },
      tanilar: [['Sıvı volüm fazlalığı', true], ['Sıvı volüm eksikliği', false], ['Hipotermi', false]], hedef: 'Günlük tartıda kilo azalacak, ödem ve nefes darlığı gerileyecek.',
      girisim: [['Her sabah aynı saatte, aynı tartıyla tart', true], ['Aldığı-çıkardığı sıvıyı izle', true], ['Yarı oturur pozisyon ver', true], ['Skoru ve kilo artışını hekime bildir', true], ['Bol sıvı içmesini öner', false]] }),
    H({ id: 'inme', cins: 'K', yas: 70, tani: 'Akut iskemik inme, 1. gün', durum: 'Yutkunurken öksürüyor; sağ kolu güçsüz.', bilincT: 'Seslenince gözünü açıp yanıt veriyor, sonra yeniden uykuya dalıyor; bu sabah uyanıktı.',
      v: { sol: 18, spo2: 96, o2: false, sis: 168, dia: 96, nabiz: 78, bilinc: 'V', ates: 36.9 },
      tanilar: [['Aspirasyon riski', true], ['Aktivite intoleransı', false], ['Bilgi eksikliği', false]], hedef: 'Aspirasyon olmayacak; bilinç değişikliği hemen değerlendirilecek.',
      girisim: [['Bilinçteki yeni düşüşü hekime acil bildir', true], ['Yutma taraması yapılana kadar ağızdan bir şey verme', true], ['Yatak başını 30–45° yükselt', true], ['Ağız bakımı yap, DKT konsültasyonu iste', true], ['Susadı diye pipetle su ver', false]] }),
    H({ id: 'basi', cins: 'E', yas: 84, tani: 'İnme sonrası yatağa bağımlı', durum: 'Sakrumda 3 cm’lik yüzeyel açık yara (evre 2); iştahı az.', bilincT: 'Uyanık, yönelimi tam.',
      v: { sol: 16, spo2: 95, o2: false, sis: 118, dia: 70, nabiz: 72, bilinc: 'A', ates: 36.7 },
      tanilar: [['Deri bütünlüğünde bozulma', true], ['Akut konfüzyon', false], ['Hipertermi', false]], hedef: 'Yara küçülecek; yeni bası yarası gelişmeyecek.',
      girisim: [['En az 2 saatte bir pozisyon değiştir', true], ['Basınç azaltıcı yatak kullan', true], ['Yarayı aseptik teknikle temizleyip uygun örtüyle kapat', true], ['Beslenme ve sıvı alımını değerlendir; Braden skorunu kaydet', true], ['Kızarık bölgeye masaj yap', false]] })
  ];

  /* =========================== beceri istasyonları =========================== */
  V.BECERI = [
    { id: 'iv', ad: 'Periferik damar yolu', ikon: 'iv', malzeme: [['Eldiven', true], ['Turnike', true], ['Klorheksidin-alkol antiseptik', true], ['Uygun numara kateter', true], ['Şeffaf örtü', true], ['Serum fizyolojikle yıkama enjektörü', true], ['Kesici-delici atık kutusu', true], ['Spatül', false], ['Üriner sonda', false]],
      adim: ['Hastayı iki tanımlayıcıyla doğrula, işlemi açıkla', 'El hijyeni yap, eldiven giy', 'Turnikeyi girişim yerinin 10–15 cm üstüne bağla', 'Damarı seç: distalden başla, eklem üstünden kaçın', 'Cildi antiseptikle sil ve kurumasını bekle', 'Kateteri 10–30° açıyla ilerlet; geri kan gelince kanülü ilerletip iğneyi çek', 'Turnikeyi çöz', 'Serum fizyolojikle yıka, şeffaf örtüyle sabitle', 'Keskin atığı kutuya at; tarih, saat ve numarayı kaydet'],
      karar: [{ s: 'Erişkinde rutin sıvı ve ilaç için kateter numarası?', o: [['14G', false, 'Çok kalın; travma ve hızlı sıvı içindir.'], ['18G', false, 'Transfüzyon ve hızlı sıvı için; rutinde gereksiz büyük.'], ['20–22G', true, 'Rutin sıvı ve ilaç için yeterli, damara daha az zarar verir.'], ['26G', false, 'Yenidoğan içindir.']] }],
      bolge: { tip: 'kol', soru: 'Rutin damar yolu için en uygun bölge?', dogru: 'onkol', L: [['elsirt', 'El sırtı', 70, 210], ['onkol', 'Ön kol (sefalik/bazilik)', 150, 170], ['antekubital', 'Dirsek içi (antekübital)', 230, 140], ['bilek', 'El bileği iç yüzü', 104, 196]], geri: 'Ön kol uzun süreli kullanımda konforludur; eklem üstü (dirsek içi, bilek) bükülmeyle kateteri tıkar ve yerinden çıkarır.' } },
    { id: 'im', ad: 'Kas içi enjeksiyon (ventrogluteal)', ikon: 'im', malzeme: [['Eldiven', true], ['Uygun enjektör ve iğne', true], ['Antiseptik', true], ['Kuru pamuk', true], ['Kesici-delici atık kutusu', true], ['Turnike', false], ['Steril pansuman seti', false]],
      adim: ['İstemi ve ilacı doğrula, hastayı iki tanımlayıcıyla tanı', 'El hijyeni, eldiven; ilacı hazırla ve havayı çıkar', 'Hastayı yan yatır, bölgeyi anatomik işaretlerle bul', 'Cildi antiseptikle sil, kurumasını bekle', 'Z yöntemiyle cildi yana çek, iğneyi 90° tek hareketle batır', 'İlacı yavaşça ver', 'İğneyi çek, cildi bırak; masaj yapma', 'Atığı kutuya at, uygulamayı kaydet'],
      karar: [{ s: 'İğnenin giriş açısı?', o: [['15°', false, 'Deri içi (intradermal) açıdır.'], ['45°', false, 'Deri altı için kullanılabilir.'], ['90°', true, 'Kas içi uygulama dik açıyla yapılır.']] }],
      bolge: { tip: 'kalca', soru: 'Erişkinde 3 ml ilaç için en güvenli bölge?', dogru: 'vg', L: [['vg', 'Ventrogluteal', 196, 150], ['dg', 'Dorsogluteal (kalçanın üst dış dörtte biri)', 236, 168], ['delt', 'Deltoid', 150, 46], ['vl', 'Vastus lateralis', 200, 236]], geri: 'Ventrogluteal bölgede büyük damar ve sinir yoktur, kas kalındır. Dorsogluteal bölge siyatik sinire yakındır; deltoid yalnız küçük hacimler içindir.' } },
    { id: 'sc', ad: 'Deri altı insülin (kalem)', ikon: 'sc', malzeme: [['Eldiven', true], ['İnsülin kalemi ve yeni iğne', true], ['Antiseptik', true], ['Kesici-delici atık kutusu', true], ['Kan şekeri ölçüm cihazı', true], ['Turnike', false], ['Aspirasyon için boş enjektör', false]],
      adim: ['Hastayı iki tanımlayıcıyla doğrula; insülin türünü ve dozunu istemle karşılaştır (ikinci hemşireyle kontrol)', 'Kan şekerini ölç ve öğün durumunu sor', 'Kaleme yeni iğne tak, 2 ünite havayla iğneyi doldur (prime)', 'Dozu ayarla, bölgeyi rotasyon planına göre seç', 'Cildi temizle ve kurumasını bekle', 'Gerekiyorsa deri kıvrımı yap, iğneyi dik batır', 'Dozu ver, iğneyi 10 saniye tut, aspirasyon ve masaj yapma', 'İğneyi atık kutusuna at, dozu ve bölgeyi kaydet'],
      karar: [{ s: 'Deri altı insülinde aspirasyon yapılır mı?', o: [['Evet, her zaman', false, 'Deri altı dokuda büyük damar yoktur; aspirasyon dokuya zarar verir.'], ['Hayır', true, 'Önerilmez; dokuyu zedeler ve gereksizdir.']] }],
      bolge: { tip: 'govde', soru: 'Hızlı etkili insülin için en hızlı emilen bölge?', dogru: 'karin', L: [['karin', 'Karın (göbek çevresi 5 cm hariç)', 150, 140], ['kol', 'Kolun arka yüzü', 70, 110], ['uyluk', 'Uyluk ön-dış yüzü', 128, 236], ['gobek', 'Göbeğin hemen çevresi', 150, 124]], geri: 'Karından emilim en hızlı ve düzenlidir; göbek çevresindeki 5 cm’lik alandan kaçınılır. Bölgeler arasında ve bölge içinde rotasyon lipohipertrofiyi önler.' } },
    { id: 'sonda', ad: 'Üriner kateter (kadın, steril)', ikon: 'sonda', malzeme: [['Steril sonda seti ve eldiven', true], ['Uygun numara Foley kateter', true], ['Steril su (balon için)', true], ['Steril kayganlaştırıcı', true], ['Kapalı drenaj torbası', true], ['Turnike', false], ['Antibiyotikli merhem', false]],
      adim: ['Hastayı tanı, işlemi açıkla, mahremiyeti sağla', 'El hijyeni; sırtüstü, dizler bükük pozisyon ver', 'Steril alanı aç, steril eldiven giy', 'Perineyi önden arkaya temizle', 'Kayganlaştırılmış kateteri meatusa yerleştir; idrar gelince 2–3 cm daha ilerlet', 'Balonu steril suyla şişir, kateteri hafifçe geri çek', 'Torbayı mesane seviyesinin altında, yere değmeden as', 'Saati, kateter numarasını ve idrarı kaydet'],
      karar: [{ s: 'Balon neyle şişirilir?', o: [['Hava', false, 'Hava balonu yüzdürür ve söner.'], ['Serum fizyolojik', false, 'Tuz kristalleri balonu tıkayabilir; kılavuzlar steril suyu önerir.'], ['Steril su', true, 'Üretici önerdiği hacimde steril su kullanılır.']] }],
      bolge: null },
    { id: 'yara', ad: 'Aseptik pansuman', ikon: 'yara', malzeme: [['Steril pansuman seti', true], ['Steril eldiven', true], ['Serum fizyolojik', true], ['Uygun yara örtüsü', true], ['Temiz eldiven (eski örtü için)', true], ['Turnike', false], ['Pamuklu bant (doğrudan yaraya)', false]],
      adim: ['Hastayı tanı, işlemi açıkla; ağrıyı değerlendir, gerekiyorsa analjeziyi önceden planla', 'El hijyeni; temiz eldivenle eski örtüyü çıkar', 'Yarayı değerlendir: boyut, doku, akıntı, koku, kızarıklık', 'Eldiven değiştir, steril seti aç, steril eldiven giy', 'Yarayı serum fizyolojikle merkezden dışa doğru temizle', 'Kurula ve uygun örtüyle kapat', 'Örtüye tarih yaz, atıkları ayır', 'Yaranın görünümünü ve uygulamayı kaydet'],
      karar: [{ s: 'Temizlik yönü?', o: [['Dıştan merkeze', false, 'Kirli çevreden mikroorganizmayı yaraya taşır.'], ['Merkezden dışa', true, 'Temiz bölgeden kirli bölgeye doğru temizlenir.'], ['İleri-geri ovarak', false, 'Dokuyu zedeler ve kirliliği yayar.']] }],
      bolge: null }
  ];

  /* =========================== ilaç uygulama =========================== */
  V.DOGRU = [['hasta', 'Doğru hasta'], ['ilac', 'Doğru ilaç'], ['doz', 'Doğru doz'], ['yol', 'Doğru yol'], ['zaman', 'Doğru zaman'], ['alerji', 'İlaç öyküsü / alerji'], ['yok', 'Hata yok, uygulanabilir']];
  var U = function (o) { return o; };
  V.UYG = [
    U({ id: 'u1', bileklik: { ad: 'Ahmet Kaya', dt: '12.03.1951', no: '204517' }, alerji: 'Yok', istem: ['Furosemid', '40 mg', 'IV', '08:00'], hazir: ['Furosemid', '40 mg', 'IV', '08:00'], hasta: { ad: 'Ahmet Kaya', no: '204517' }, hata: ['yok'], neden: 'İstem, hazırlanan ilaç ve bileklik birbiriyle tutarlı; uygulanabilir. Uygulamadan sonra kaydetmeyi ve diürezi izlemeyi unutma.' }),
    U({ id: 'u2', bileklik: { ad: 'Fatma Yılmaz', dt: '04.07.1946', no: '204522' }, alerji: 'Penisilin', istem: ['Seftriakson', '1 g', 'IV', '10:00'], hazir: ['Ampisilin', '1 g', 'IV', '10:00'], hasta: { ad: 'Fatma Yılmaz', no: '204522' }, hata: ['ilac', 'alerji'], neden: 'Hazırlanan ilaç istemdekinden farklı (ampisilin) ve bir penisilin; hastanın penisilin alerjisi var. İki hata birden.' }),
    U({ id: 'u3', bileklik: { ad: 'Mehmet Demir', dt: '22.11.1958', no: '204530' }, alerji: 'Yok', istem: ['Enoksaparin', '40 mg', 'SC', '20:00'], hazir: ['Enoksaparin', '80 mg', 'SC', '20:00'], hasta: { ad: 'Mehmet Demir', no: '204530' }, hata: ['doz'], neden: 'İstem 40 mg, hazırlanan 80 mg: antikoagülanda iki kat doz ciddi kanama riski.' }),
    U({ id: 'u4', bileklik: { ad: 'Ayşe Şahin', dt: '30.01.1963', no: '204541' }, alerji: 'Yok', istem: ['Metoklopramid', '10 mg', 'IV', '12:00'], hazir: ['Metoklopramid', '10 mg', 'IM', '12:00'], hasta: { ad: 'Ayşe Şahin', no: '204541' }, hata: ['yol'], neden: 'İstem damar yolundan, hazırlanan kas içi. Yol değişikliği hekim istemi olmadan yapılmaz.' }),
    U({ id: 'u5', bileklik: { ad: 'Hasan Çelik', dt: '15.05.1949', no: '204555' }, alerji: 'Yok', istem: ['Parasetamol', '1 g', 'IV', '06:00'], hazir: ['Parasetamol', '1 g', 'IV', '02:00'], hasta: { ad: 'Hasan Çelik', no: '204555' }, hata: ['zaman'], neden: 'Bir önceki doz 00:00’da verilmiş; 02:00’de vermek doz aralığını (en az 4–6 saat) ihlal eder.' }),
    U({ id: 'u6', bileklik: { ad: 'Zehra Aydın', dt: '09.09.1955', no: '204560' }, alerji: 'Yok', istem: ['İnsülin aspart', '6 ünite', 'SC', 'Öğle yemeğiyle'], hazir: ['İnsülin aspart', '6 ünite', 'SC', 'Öğle yemeğiyle'], hasta: { ad: 'Zehra Aydın', no: '204561' }, hata: ['hasta'], neden: 'Bileklikteki protokol numarası (204560) ilaç kartındakiyle (204561) uyuşmuyor: başka bir hastanın ilacı olabilir. İki tanımlayıcıyla doğrula.' }),
    U({ id: 'u7', bileklik: { ad: 'Kemal Arslan', dt: '01.02.1960', no: '204572' }, alerji: 'Aspirin (bronkospazm)', istem: ['Asetilsalisilik asit', '100 mg', 'Oral', '09:00'], hazir: ['Asetilsalisilik asit', '100 mg', 'Oral', '09:00'], hasta: { ad: 'Kemal Arslan', no: '204572' }, hata: ['alerji'], neden: 'İstem ve ilaç tutarlı ama hastanın aspirine karşı bronkospazm öyküsü var: uygulamadan önce hekimle görüş.' }),
    U({ id: 'u8', bileklik: { ad: 'Emine Koç', dt: '18.06.1944', no: '204580' }, alerji: 'Yok', istem: ['Potasyum klorür', '20 mmol / 500 ml', 'IV infüzyon (4 saatte)', '14:00'], hazir: ['Potasyum klorür', '20 mmol', 'IV puşe (doğrudan)', '14:00'], hasta: { ad: 'Emine Koç', no: '204580' }, hata: ['yol'], neden: 'Potasyum klorür asla doğrudan (puşe) verilmez: kalp durmasına yol açabilir. Mutlaka seyreltilip infüzyonla verilir.' })
  ];
  /* damla ve pompa: ml, dakika, damla faktörü (gtt/ml) */
  V.damla = function (ml, dk, f) { return ml * f / dk; };
  V.pompa = function (ml, saat) { return ml / saat; };
  V.hizProblem = function (r) {
    r = r || Math.random; var sec = function (L) { return L[Math.floor(r() * L.length)]; };
    var tip = sec(['makro', 'mikro', 'pompa']), ml = sec([250, 500, 1000]), saat = sec([2, 4, 6, 8]);
    if (tip === 'pompa') return { tip: tip, metin: ml + ' ml sıvı ' + saat + ' saatte infüzyon pompasıyla verilecek. Pompayı kaç ml/saate ayarlarsın?', cevap: Math.round(V.pompa(ml, saat) * 10) / 10, birim: 'ml/saat', tol: 0.5, ml: ml, saat: saat, cozum: ['Hız = hacim ÷ süre', ml + ' ÷ ' + saat + ' = ' + String(Math.round(ml / saat * 10) / 10).replace('.', ',') + ' ml/saat'] };
    var f = tip === 'makro' ? 20 : 60, dk = saat * 60, c = V.damla(ml, dk, f);
    return { tip: tip, metin: ml + ' ml sıvı ' + saat + ' saatte ' + (tip === 'makro' ? 'standart (makro, 20 damla/ml)' : 'mikro (60 damla/ml)') + ' setle gravite ile verilecek. Dakikada kaç damla?', cevap: Math.round(c), birim: 'damla/dk', tol: 1, ml: ml, saat: saat, f: f, cozum: ['Damla/dk = hacim (ml) × damla faktörü ÷ süre (dk)', ml + ' × ' + f + ' ÷ ' + dk + ' = ' + String(Math.round(c * 10) / 10).replace('.', ',') + ' ≈ ' + Math.round(c) + ' damla/dk'] };
  };

  /* =========================== servis vardiyası =========================== */
  var SV = function (o) { return o; };
  V.SERVIS = [
    SV({ id: 's-pnomoni', ad: 'Mehmet Bey', yas: 72, oda: '301', tani: 'Pnömoni', ozet: 'SpO₂ oda havasında %89, solunum 26/dk; gece huzursuzdu.', oncelik: 1,
      olay: { metin: 'SpO₂ %86’ya düştü, konuşurken nefesi kesiliyor.', o: [['Yarı oturur pozisyon, istemdeki oksijen, NEWS2; hekime ve acil müdahale ekibine haber', true], ['Bir saat sonra yeniden ölç', false], ['Sakinleşsin diye uyku ilacı ver', false]] },
      sbar: { S: 'Mehmet Bey’in SpO₂’si %86’ya düştü, solunumu 28/dk.', B: '72 yaş, pnömoni tanısıyla 2. gün; antibiyotik alıyor.', A: 'NEWS2 skoru 9; solunum yetmezliği gelişiyor olabilir.', R: 'Hemen gelip değerlendirmenizi ve oksijen istemini güncellemenizi istiyorum.' } }),
    SV({ id: 's-transf', ad: 'Leyla Hanım', yas: 61, oda: '305', tani: 'Anemi, eritrosit süspansiyonu', ozet: 'Transfüzyon 10 dakika önce başladı.', oncelik: 1.5,
      olay: { metin: 'Transfüzyonun 15. dakikasında titreme, ateş 38,9 °C ve bel ağrısı başladı.', o: [['Transfüzyonu hemen durdur, damar yolunu serum fizyolojikle açık tut, vitalleri ölç, hekime ve kan bankasına bildir, torbayı sakla', true], ['Hızı yavaşlat ve devam et', false], ['Ateş düşürücü verip transfüzyonu sürdür', false]] },
      sbar: { S: 'Leyla Hanım’da transfüzyonun 15. dakikasında titreme, ateş ve bel ağrısı başladı; transfüzyonu durdurdum.', B: '61 yaş, anemi nedeniyle ilk ünite eritrosit süspansiyonu.', A: 'Akut hemolitik transfüzyon reaksiyonu olabilir.', R: 'Hemen değerlendirmenizi, kan bankası tetkikleri için istem yazmanızı istiyorum.' } }),
    SV({ id: 's-hipo', ad: 'Hüsnü Bey', yas: 68, oda: '302', tani: 'Tip 2 diyabet', ozet: 'Kahvaltı yemedi; kan şekeri 62 mg/dL; öğle insülini yaklaşıyor.', oncelik: 2,
      olay: { metin: 'Terliyor, titriyor; kan şekeri 58 mg/dL. Bilinci açık.', o: [['15 g hızlı karbonhidrat ver, 15 dk sonra ölç, hekime bildir; insülini birlikte değerlendir', true], ['Öğle insülinini hemen uygula', false], ['Yemeği gelene kadar beklet', false]] },
      sbar: { S: 'Hüsnü Bey’in kan şekeri 58 mg/dL; terleme ve titreme var.', B: '68 yaş, tip 2 diyabet, insülin kullanıyor; kahvaltı yemedi.', A: 'Hipoglisemi; 15 g karbonhidrat verdim, 15 dakikada yeniden ölçeceğim.', R: 'Öğle insülin dozunu birlikte gözden geçirmenizi istiyorum.' } }),
    SV({ id: 's-kky', ad: 'Hatice Hanım', yas: 77, oda: '308', tani: 'Kalp yetmezliği', ozet: 'Sabah tartısında 2 kg artış; bacaklarda ödem.', oncelik: 2.5,
      olay: { metin: 'Yatarken nefesi daralıyor, iki yastıkla uyuyabiliyor.', o: [['Yarı oturur pozisyon, aldığı-çıkardığı ve tartıyı izle; hekime bildir', true], ['Bol su içmesini öner', false], ['Düz yatır', false]] },
      sbar: { S: 'Hatice Hanım bir günde 2 kg aldı, yatarken nefesi daralıyor.', B: '77 yaş, kalp yetmezliği; diüretik alıyor.', A: 'Sıvı yüklenmesi artıyor olabilir; SpO₂ %93.', R: 'Diüretik dozunu değerlendirmenizi istiyorum.' } }),
    SV({ id: 's-apend', ad: 'Burak Bey', yas: 34, oda: '310', tani: 'Apendektomi sonrası 2. gün', ozet: 'Ateş 38,4 °C; yara çevresi kızarık ve hassas.', oncelik: 3,
      olay: { metin: 'Yara yerinden bulanık akıntı geliyor.', o: [['Yarayı değerlendir, aseptik pansuman yap, akıntıyı kaydet, hekime bildir', true], ['Pansumanı açmadan üstüne yeni gazlı bez koy', false], ['Taburculuk için hazırla', false]] },
      sbar: { S: 'Burak Bey’in yara yerinden bulanık akıntı geliyor, ateşi 38,4.', B: '34 yaş, apendektomi sonrası 2. gün.', A: 'Yara yeri enfeksiyonu düşünüyorum.', R: 'Yarayı görmenizi ve kültür istemini değerlendirmenizi istiyorum.' } }),
    SV({ id: 's-postop', ad: 'Ayten Hanım', yas: 64, oda: '304', tani: 'Kalça protezi, ameliyat günü', ozet: 'Ağrı 8/10; vitaller stabil; istemde “gerektiğinde” analjezik var.', oncelik: 3.2,
      olay: { metin: 'Ağrısının 8/10 olduğunu, hareket edemediğini söylüyor.', o: [['İstemdeki analjeziği uygula, 30–60 dk sonra yeniden değerlendir', true], ['Sabah viziteyi bekle', false], ['Ağrı kesicinin bağımlılık yapacağını söyle', false]] },
      sbar: { S: 'Ayten Hanım’ın ağrısı 8/10, gerektiğinde istemindeki analjeziği verdim.', B: '64 yaş, bugün kalça protezi ameliyatı oldu.', A: 'Vitalleri stabil; ağrı kontrolü yetersiz.', R: 'Düzenli analjezi planını gözden geçirmenizi istiyorum.' } }),
    SV({ id: 's-dusme', ad: 'Nuran Hanım', yas: 80, oda: '306', tani: 'Kalça kırığı, ameliyat bekliyor', ozet: 'Gece yataktan kalkmaya çalıştı; zaman zaman yeri karıştırıyor.', oncelik: 3.5,
      olay: { metin: 'Yataktan kalkmaya çalışıyor, “eve gideceğim” diyor.', o: [['Yanına git, sakin yönlendir, tuvalet ihtiyacını sor; yatak alçak, zil yakında; deliryum için hekime bildir', true], ['Bileklerinden yatağa bağla', false], ['Kapıyı kapatıp odadan çık', false]] },
      sbar: { S: 'Nuran Hanım yataktan kalkmaya çalışıyor, yeri ve zamanı karıştırıyor.', B: '80 yaş, kalça kırığı; ameliyat bekliyor.', A: 'Deliryum ve düşme riski yüksek.', R: 'Deliryum açısından değerlendirmenizi istiyorum.' } }),
    SV({ id: 's-taburcu', ad: 'Selim Bey', yas: 45, oda: '312', tani: 'Yeni tanı tip 1 diyabet', ozet: 'Bugün taburcu; insülin kalemi eğitimi bekliyor.', oncelik: 5,
      olay: { metin: 'Kalemi evde nasıl kullanacağını soruyor.', o: [['Göster-geri göster yöntemiyle eğit, yazılı materyal ver, sorularını yanıtla', true], ['Broşürü verip odadan çık', false], ['Eşine anlatırsın de', false]] },
      sbar: { S: 'Selim Bey taburculuğa hazır; insülin eğitimi tamamlandı.', B: '45 yaş, yeni tanı tip 1 diyabet.', A: 'Kalemi doğru kullanıyor, hipoglisemi belirtilerini biliyor.', R: 'Taburculuk istemini ve kontrol randevusunu yazmanızı istiyorum.' } })
  ];
  /* öncelik puanı: öğrenci sırası (id dizisi) ile doğru sıra arasındaki uyum (Spearman benzeri, 0..1) */
  V.dogruSira = function (ids) { return ids.slice().sort(function (a, b) { return V.servis(a).oncelik - V.servis(b).oncelik; }); };
  V.servis = function (id) { return V.SERVIS.filter(function (x) { return x.id === id; })[0]; };
  V.siraPuan = function (sec) {
    var d = V.dogruSira(sec), n = sec.length, top = 0, max = 0;
    sec.forEach(function (id, i) { top += Math.abs(i - d.indexOf(id)); });
    for (var i = 0; i < n; i++) max += Math.abs(i - (n - 1 - i));
    return max ? Math.round((1 - top / max) * 100) / 100 : 1;
  };

  /* =========================== Acadex Medica vaka dosyaları ===========================
     7. kat (dahiliye servisi) hastalarıyla aynı kişi: ad ve yaş senaryoyla AYNI. */
  V.VAKA = [
    { id: 'pnomoni', ad: 'Rasim Bey', yas: '76 yaş', renk: '#CFE3F7', sikayet: 'Pnömoni nedeniyle yatıyor; gece nefes darlığı arttı.', oyku: 'KOAH yok. 2 L/dk oksijen. Antibiyotik 2. gün.',
      deg: [['vital', 'Tüm vital bulguları ölç ve NEWS2 hesapla', true], ['solunum', 'Solunum eforunu, yardımcı kas kullanımını gözle', true], ['bilinc', 'Bilinci ACVPU ile değerlendir', true], ['tartim', 'Boy ve kilo ölç', false], ['ekg', 'Rutin EKG çek', false]],
      bulgu: 'Solunum 26/dk, SpO₂ %91 (2 L/dk), nabız 114, TA 100/60, ateş 38,7 °C, uyanık. NEWS2 = 13.',
      tani: [['gaz', 'Gaz değişiminde bozulma', true], ['bilgi', 'Bilgi eksikliği', false], ['kabiz', 'Kabızlık', false]],
      terapi: [['poz', 'Yarı oturur pozisyon ver', true], ['ekip', 'Hekime ve acil müdahale ekibine hemen haber ver', true], ['o2', 'İstemdeki oksijeni sürdür, SpO₂’yi sürekli izle', true], ['sbar', 'Bildirimi SBAR ile yap', true], ['uyku', 'Uyuması için ışıkları kapatıp beklemeye al', false]],
      ozet: 'NEWS2 ≥7 acil müdahale ekibini gerektirir. Hemşire skoru hesaplar, pozisyon ve oksijenle ilk desteği verir ve SBAR ile net bir bildirim yapar.' },
    { id: 'postop', ad: 'Gülay Hanım', yas: '54 yaş', renk: '#F9E3D3', sikayet: 'Ameliyat sonrası 1. gün; derin nefes almaktan ve kalkmaktan kaçınıyor.', oyku: 'Laparoskopik kolesistektomi. İstemde düzenli parasetamol ve gerektiğinde opioid var.',
      deg: [['agri', 'Ağrıyı sayısal ölçekle değerlendir (yer, şiddet, nitelik)', true], ['vital', 'Vital bulguları ölç', true], ['insizyon', 'İnsizyon yerini ve pansumanı gözle', true], ['kultur', 'İdrar kültürü al', false]],
      bulgu: 'Ağrı 7/10, öksürünce 9/10. Vitaller stabil; insizyonlar temiz.',
      tani: [['agri', 'Akut ağrı (cerrahi girişime bağlı)', true], ['enf', 'Enfeksiyon', false], ['sivi', 'Sıvı volüm fazlalığı', false]],
      terapi: [['analjezi', 'İstemdeki analjeziği uygula, 30–60 dk sonra yeniden değerlendir', true], ['destek', 'Öksürürken yastıkla desteklemeyi öğret', true], ['mobil', 'Erken mobilizasyonu destekle', true], ['bekle', 'Ağrının kendiliğinden geçmesini bekle', false]],
      ozet: 'Kontrol edilmeyen ağrı derin solunumu ve hareketi engeller, akciğer komplikasyonu riskini artırır. Ölç, uygula, yeniden ölç.' },
    { id: 'sepsis', ad: 'Saniye Hanım', yas: '70 yaş', renk: '#FBD9D3', sikayet: 'İdrar yolu enfeksiyonu; bu sabah konfüzyon başladı, idrarı azaldı.', oyku: 'Diyabet. Antibiyotik bugün başlanacak.',
      deg: [['vital', 'Vital bulgular ve NEWS2', true], ['bilinc', 'Bilinçteki yeni değişikliği değerlendir', true], ['idrar', 'Saatlik idrar çıkışını izle', true], ['boy', 'Boy ölç', false]],
      bulgu: 'TA 90/52, nabız 120, solunum 23, SpO₂ %95, ateş 39,4 °C, yeni konfüzyon. NEWS2 = 13. İdrar 15 ml/saat.',
      tani: [['sok', 'Şok riski (sepsis)', true], ['uyku', 'Uyku örüntüsünde bozulma', false], ['bilgi', 'Bilgi eksikliği', false]],
      terapi: [['ekip', 'Hekime ve acil müdahale ekibine hemen haber ver', true], ['bundle', 'İstemle kültür, laktat, sıvı ve antibiyotiği gecikmeden başlat', true], ['izlem', 'Vitalleri ve idrar çıkışını sık izle', true], ['bekle', 'Antibiyotiği ertesi sabah başlat', false]],
      ozet: 'Sepsiste her saatlik gecikme kötü sonucu artırır. Yeni konfüzyon, düşük tansiyon ve az idrar alarm bulgularıdır.' },
    { id: 'hipogl', ad: 'Kemal Bey', yas: '66 yaş', renk: '#FFF0C9', sikayet: 'Diyabet; kahvaltı yemedi, terliyor ve titriyor.', oyku: 'Sabah 8’de 10 ünite insülin yapılmış.',
      deg: [['ks', 'Parmak ucu kan şekeri ölç', true], ['bilinc', 'Bilinci ve yutabildiğini değerlendir', true], ['ogun', 'Öğün ve insülin zamanını sor', true], ['ekg', 'Rutin EKG', false]],
      bulgu: 'Kan şekeri 52 mg/dL; bilinci açık, yutabiliyor.',
      tani: [['hipo', 'Kan şekeri düzeyinde dengesizlik (hipoglisemi)', true], ['enf', 'Enfeksiyon riski', false], ['agri', 'Akut ağrı', false]],
      terapi: [['15', '15 g hızlı karbonhidrat ver', true], ['tekrar', '15 dakika sonra yeniden ölç', true], ['hekim', 'Hekime bildir; insülin planını birlikte değerlendir', true], ['insulin', 'Öğle insülinini her zamanki gibi uygula', false]],
      ozet: '15-15 kuralı: 15 g hızlı karbonhidrat, 15 dakikada yeniden ölçüm. Bilinci kapalı hastaya ağızdan bir şey verilmez.' },
    { id: 'dusme', ad: 'Münevver Hanım', yas: '82 yaş', renk: '#E5E7F6', sikayet: 'Kalça kırığı; gece tek başına kalkmaya çalıştı.', oyku: 'Görmesi zayıf; idrar söktürücü kullanıyor.',
      deg: [['skor', 'Düşme riski skorunu hesapla', true], ['ortam', 'Ortam güvenliğini değerlendir (yatak, zil, ışık)', true], ['bilinc', 'Konfüzyon var mı bak', true], ['kan', 'Kan şekeri ölç', false]],
      bulgu: 'Düşme riski yüksek; zil uzakta, yatak yüksek, gece ışığı kapalı.',
      tani: [['dusme', 'Düşme riski', true], ['gaz', 'Gaz değişiminde bozulma', false], ['agri', 'Akut ağrı', false]],
      terapi: [['yatak', 'Yatağı alçalt, frenleri kilitle, zili yanına koy', true], ['tuvalet', 'Düzenli tuvalet planı ve gece ışığı', true], ['corap', 'Kaymaz çorap; riski kaydet ve devret', true], ['bag', 'Bileklerinden bağla', false]],
      ozet: 'Düşmeyi önlemenin yolu kısıtlama değil, ortam ve ihtiyaç düzenlemesidir. Fiziksel kısıtlama düşme ve yaralanmayı artırabilir.' },
    { id: 'basi', ad: 'Ziya Bey', yas: '84 yaş', renk: '#F2E6D8', sikayet: 'Yatağa bağımlı; sakrumda açık yara.', oyku: 'İnme sonrası; iştahı az.',
      deg: [['yara', 'Yarayı evrele ve ölç (boyut, doku, akıntı)', true], ['braden', 'Braden skoru hesapla', true], ['beslenme', 'Beslenme ve sıvı alımını değerlendir', true], ['eeg', 'EEG iste', false]],
      bulgu: '3 × 2 cm, kısmi kalınlıkta açık yara (evre 2); Braden 12 (yüksek risk).',
      tani: [['deri', 'Deri bütünlüğünde bozulma', true], ['hiper', 'Hipertermi', false], ['konf', 'Akut konfüzyon', false]],
      terapi: [['poz', 'En az 2 saatte bir pozisyon değiştir', true], ['yatak', 'Basınç azaltıcı yatak', true], ['pansuman', 'Aseptik pansuman ve uygun örtü', true], ['masaj', 'Kızarık bölgeye masaj yap', false]],
      ozet: 'Bası yarasında basıncı kaldırmak, nemi ve beslenmeyi yönetmek temel; kızarık bölgeye masaj dokuyu daha da zedeler.' },
    { id: 'transf', ad: 'Leyla Hanım', yas: '61 yaş', renk: '#F6CFCF', sikayet: 'Eritrosit süspansiyonunun 15. dakikasında titreme ve bel ağrısı.', oyku: 'Anemi; ilk ünite.',
      deg: [['durdur', 'Transfüzyonu durdurup vital bulguları ölç', true], ['kimlik', 'Ürün ve hasta kimliğini yeniden kontrol et', true], ['idrar', 'İdrarın rengine bak', true], ['tarti', 'Tartı yap', false]],
      bulgu: 'Ateş 38,9 °C, nabız 122, TA 96/58; idrar koyu renkli.',
      tani: [['reak', 'Transfüzyon reaksiyonu (akut hemolitik olabilir)', true], ['grip', 'Grip', false], ['agri', 'Kronik ağrı', false]],
      terapi: [['dur', 'Transfüzyonu durdur, damar yolunu serum fizyolojikle açık tut', true], ['bildir', 'Hekime ve kan bankasına bildir, torbayı ve seti sakla', true], ['izle', 'Vitalleri ve idrar çıkışını sık izle', true], ['yavas', 'Hızı yavaşlatıp devam et', false]],
      ozet: 'Transfüzyonun ilk 15 dakikası en riskli dönemdir. Reaksiyonda ilk iş durdurmaktır; ürün ve set incelenmek üzere saklanır.' },
    { id: 'kky', ad: 'Nihat Bey', yas: '78 yaş', renk: '#DCEBF5', sikayet: 'Kalp yetmezliği; bir günde 2 kg aldı, yatarken nefesi daralıyor.', oyku: 'Diüretik kullanıyor; tuz kısıtlaması önerilmiş.',
      deg: [['tarti', 'Aynı saatte aynı tartıyla tart', true], ['io', 'Aldığı-çıkardığı sıvıyı hesapla', true], ['odem', 'Ödemi ve akciğer seslerini değerlendir', true], ['boy', 'Boy ölç', false]],
      bulgu: '+2 kg; bacaklarda gode bırakan ödem; aldığı 2200 ml, çıkardığı 900 ml; SpO₂ %93.',
      tani: [['sivi', 'Sıvı volüm fazlalığı', true], ['eksik', 'Sıvı volüm eksikliği', false], ['hipo', 'Hipotermi', false]],
      terapi: [['poz', 'Yarı oturur pozisyon ver', true], ['bildir', 'Kilo artışını ve dengeyi hekime bildir', true], ['kisit', 'Sıvı ve tuz kısıtlaması istemine uyumu destekle', true], ['su', 'Bol su içmesini öner', false]],
      ozet: 'Günlük tartı kalp yetmezliğinde sıvı birikiminin en duyarlı göstergesidir; 1–2 günde 2 kg artış hekime bildirilir.' }
  ];
  return V;
});
