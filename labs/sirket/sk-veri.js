/* ==========================================================================
   ACADEX ŞİRKET · veri (labs/sirket/sk-veri.js), 29.10.2026
   Bütün şirketler, ürünler ve rakamlar KURGUSALDIR (ders kitabı tarzı).
   Gerçek kural setleri:
     - 6102 sayılı Türk Ticaret Kanunu: şirket türleri ve sorumluluk
     - Asgari sermaye (7887 sayılı CB Kararı, 1 Ocak 2024'ten beri):
       A.Ş. 250.000 TL, kayıtlı sermayeli (halka açık olmayan) A.Ş. 500.000 TL,
       Ltd. 50.000 TL
     - Kurumlar vergisi genel oranı %25 (simülasyonda sadeleştirilmiş)
   ========================================================================== */
(function () {
  'use strict';
  var V = {};
  V.SIRKET = 'Mavi Liman A.Ş.';

  /* ---------------- BİLANÇO TERAZİSİ (bin TL) ----------------
     kalem: [anahtar, ad, taraf (A aktif / P pasif), grup, renk] */
  V.KALEM = [
    ['kasa', 'Kasa ve banka', 'A', 'dönen varlık', '#1F8A7A'],
    ['alacak', 'Ticari alacaklar', 'A', 'dönen varlık', '#2F6FB0'],
    ['stok', 'Stoklar', 'A', 'dönen varlık', '#E0A526'],
    ['makine', 'Makine ve teçhizat', 'A', 'duran varlık', '#46506A'],
    ['satici', 'Ticari borçlar (satıcılar)', 'P', 'kısa vadeli borç', '#C8553D'],
    ['kredi', 'Banka kredileri', 'P', 'uzun vadeli borç', '#B84A6B'],
    ['sermaye', 'Sermaye', 'P', 'özkaynak', '#3E8E5B'],
    ['kar', 'Dönem kârı', 'P', 'özkaynak', '#7BB98F']
  ];
  V.ACILIS = { kasa: 150, alacak: 60, stok: 90, makine: 200, satici: 80, kredi: 170, sermaye: 250, kar: 0 };
  /* olay: fx = bilanço değişimi; gt = gelir tablosu (sat, smm, gid: [ad, tutar]); nk = nakit akış türü
     n = açıklama (doğru seçince); ic = simge */
  V.OLAY = [
    { id: 1, ic: '🏦', t: 'Bankadan 100 kredi çekildi (3 yıl vadeli).', fx: { kasa: 100, kredi: 100 }, nk: 'finansman',
      n: 'Varlık (kasa) da kaynak (kredi) da 100 arttı: terazi iki kefeden birden ağırlaşır, denge bozulmaz. Kâr değişmez; borç almak gelir değildir.' },
    { id: 2, ic: '⚙', t: 'Yeni makine alındı, 60 peşin ödendi.', fx: { makine: 60, kasa: -60 }, nk: 'yatirim',
      n: 'Aktifin içinde yer değiştirme: kasa 60 azaldı, makine 60 arttı. Toplam aktif aynı; makine gider değil, yıllara amortismanla yayılır.' },
    { id: 3, ic: '📦', t: 'Maliyeti 50 olan mal 80\'e veresiye satıldı.', fx: { alacak: 80, stok: -50, kar: 30 }, gt: { sat: 80, smm: 50 }, nk: null,
      n: 'Alacak 80 arttı, stok 50 azaldı; aktif net 30 büyüdü. Aradaki 30 brüt kârdır ve özkaynağa (dönem kârı) yazılır. Kasaya tek kuruş girmedi: kâr var, nakit yok.' },
    { id: 4, ic: '💸', t: 'Satıcıya olan borcun 40\'ı ödendi.', fx: { kasa: -40, satici: -40 }, nk: 'isletme',
      n: 'İki kefe birden hafifler: kasa 40, satıcı borcu 40 azaldı. Gider değil; borç kapatmak kârı etkilemez.' },
    { id: 5, ic: '🤝', t: 'Ortaklar 50 nakit sermaye koydu.', fx: { kasa: 50, sermaye: 50 }, nk: 'finansman',
      n: 'Kasa 50, sermaye 50 arttı. Ortağın koyduğu para şirketin geliri değildir; özkaynağın kendisidir.' },
    { id: 6, ic: '🏢', t: 'Bu ayın kirası 20 peşin ödendi.', fx: { kasa: -20, kar: -20 }, gt: { gid: ['Kira gideri', 20] }, nk: 'isletme',
      n: 'Kasa 20 azaldı; karşılığında hiçbir varlık gelmedi, bu bir giderdir. Gider kârı, kâr da özkaynağı 20 azaltır.' },
    { id: 7, ic: '🚚', t: '70\'lik mal veresiye satın alındı.', fx: { stok: 70, satici: 70 }, nk: null,
      n: 'Stok 70, satıcı borcu 70 arttı. Mal alırken gider yazılmaz; mal satıldığında satılan malın maliyeti olur.' },
    { id: 8, ic: '🧾', t: 'Müşteriden 60 tahsil edildi.', fx: { kasa: 60, alacak: -60 }, nk: 'isletme',
      n: 'Aktif içinde yer değiştirme: alacak 60 azaldı, kasa 60 arttı. Satış geliri zaten satış anında yazılmıştı; tahsilat yeni gelir değildir.' },
    { id: 9, ic: '🛒', t: 'Maliyeti 55 olan mal 90\'a peşin satıldı.', fx: { kasa: 90, stok: -55, kar: 35 }, gt: { sat: 90, smm: 55 }, nk: 'isletme',
      n: 'Kasa 90 arttı, stok 55 azaldı; aradaki 35 brüt kâr özkaynağa geçti. Bu kez kâr ile nakit birlikte geldi.' },
    { id: 10, ic: '📉', t: 'Kredinin 30 anaparası ve 5 faizi ödendi.', fx: { kasa: -35, kredi: -30, kar: -5 }, gt: { gid: ['Faiz gideri', 5] }, nk: 'karma',
      n: 'Anapara 30 borcu azaltır (gider değil), faiz 5 ise giderdir ve kârı düşürür. Kasa toplam 35 azaldı.' },
    { id: 11, ic: '⏳', t: 'Makineler için 20 amortisman ayrıldı.', fx: { makine: -20, kar: -20 }, gt: { gid: ['Amortisman', 20] }, nk: null,
      n: 'Makinenin değeri 20 azaldı, kâr 20 düştü; kasadan para çıkmadı. Amortisman nakitsiz bir giderdir: nakit akışında kâra geri eklenir.' },
    { id: 12, ic: '👷', t: 'Personel maaşları 25 ödendi.', fx: { kasa: -25, kar: -25 }, gt: { gid: ['Personel gideri', 25] }, nk: 'isletme',
      n: 'Kasa 25 azaldı, karşılığında varlık yok: gider. Kâr ve özkaynak 25 azaldı.' }
  ];

  /* ---------------- MALİYET VE BAŞABAŞ (TL) ---------------- */
  V.URUN = { ad: 'Çelik termos', sabit: 180000, degisken: 54, fiyat: 90, kapasite: 12000, hedefKar: 72000 };
  /* bütçe ve gerçekleşen (aylık): satış ve doğrudan malzeme */
  V.BUTCE = {
    b: { adet: 10000, fiyat: 90, kg: 0.8, kgFiyat: 40 },
    g: { adet: 9200, fiyat: 94, kg: 0.86, kgFiyat: 38 }
  };

  /* ---------------- YATIRIM KARARI (milyon TL) ---------------- */
  V.PROJE = [
    { k: 'hat', ad: 'İkinci üretim hattı', c: '#2F6FB0', cf: [-40, 15, 19, 22, 22, 19], n: 'Kapasiteyi %50 artırır; ilk yıl alıştırma.' },
    { k: 'gunes', ad: 'Çatıya güneş paneli', c: '#E0A526', cf: [-12, 5.2, 5.2, 5.2, 5.2, 5.2], n: 'Elektrik faturasından sabit tasarruf (anüite).' },
    { k: 'dijital', ad: 'Dijital mağaza', c: '#6B4FB3', cf: [-20, 1, 6, 14, 22, 28], n: 'Yavaş başlar, sonra hızla büyür; nakdi geç gelir.' },
    { k: 'depo', ad: 'Yeni lojistik deposu', c: '#1F8A7A', cf: [-25, 11, 11.5, 12, 12, 12], n: 'Kira ve nakliye tasarrufu; dengeli akış.' }
  ];
  V.YATIRIM_BUTCE = 60;

  /* ---------------- STRATEJİ ---------------- */
  /* SWOT: [metin, doğru kutu G/Z/F/T, açıklama] */
  V.SWOT = [
    ['Limana 2 km mesafede kendi fabrikamız var.', 'G', 'Şirketin içinde, kontrol edebildiği bir avantaj: güçlü yön.'],
    ['Usta kadronun ortalama kıdemi 12 yıl.', 'G', 'Deneyimli insan kaynağı şirketin kendi gücüdür.'],
    ['Markamız yurt dışında tanınmıyor.', 'Z', 'Şirketin kendi eksiği: zayıf yön.'],
    ['Kredi borcumuz özkaynağımızın 2 katı.', 'Z', 'Yüksek kaldıraç şirketin kendi bilançosundaki bir zayıflık.'],
    ['Tek bir müşteri cironun %40\'ını oluşturuyor.', 'Z', 'Müşteri yoğunlaşması iç yapıdan kaynaklanan risk: zayıf yön.'],
    ['Avrupa\'da yerli tedarikçiye yönelme (yakın tedarik) artıyor.', 'F', 'Şirketin dışında gelişen, yararlanabileceği bir eğilim: fırsat.'],
    ['Hükümet ihracata düşük faizli kredi açtı.', 'F', 'Dış çevredeki olumlu değişiklik: fırsat.'],
    ['Online kampçılık pazarı yılda %20 büyüyor.', 'F', 'Pazardaki büyüme dış bir fırsattır.'],
    ['Uzak Doğulu rakip %15 daha ucuza satıyor.', 'T', 'Kontrol edemediğimiz dış baskı: tehdit.'],
    ['Paslanmaz çelik fiyatı 6 ayda %30 arttı.', 'T', 'Girdi fiyatı dış çevreden gelir: tehdit.'],
    ['AB yeni karbon vergisi (SKDM) getiriyor.', 'T', 'Düzenleyici dış değişiklik; uyum maliyeti yaratır: tehdit.'],
    ['Ar-Ge ekibimiz 2 patent aldı.', 'G', 'Şirketin sahip olduğu fikri mülkiyet: güçlü yön.']
  ];
  /* Porter'ın 5 gücü: kanıt cümleleri ve önerilen puan (1 zayıf baskı … 5 güçlü baskı) */
  V.PORTER = [
    { k: 'rakip', ad: 'Rakipler arası rekabet', kan: 'Pazarda 40\'tan fazla üretici var, ürünler birbirine çok benziyor, pazar yavaş büyüyor.', p: 5 },
    { k: 'yeni', ad: 'Yeni girenlerin tehdidi', kan: 'Fabrika kurmak 50 milyon TL istiyor ama teknoloji basit; dağıtım kanalları açık.', p: 3 },
    { k: 'ikame', ad: 'İkame ürün tehdidi', kan: 'Plastik ve cam termoslar ucuz; tek kullanımlık bardak alışkanlığı yaygın.', p: 4 },
    { k: 'alici', ad: 'Alıcıların pazarlık gücü', kan: 'Satışın %60\'ı 3 büyük zincir markete gidiyor; tedarikçi değiştirmeleri kolay.', p: 5 },
    { k: 'satici', ad: 'Tedarikçilerin pazarlık gücü', kan: 'Paslanmaz çelik birkaç büyük üreticiden geliyor ama ithal alternatif var.', p: 3 }
  ];
  /* BCG: pazar büyümesi (%), göreli pazar payı (bizim pay / en büyük rakibin payı) */
  V.BCG = [
    { k: 'termos', ad: 'Klasik termos', g: 3, rp: 2.4, ciro: 48, d: 'I' },
    { k: 'kamp', ad: 'Kamp ocağı', g: 22, rp: 1.6, ciro: 22, d: 'Y' },
    { k: 'akilli', ad: 'Akıllı matara', g: 28, rp: 0.3, ciro: 6, d: 'S' },
    { k: 'tencere', ad: 'Döküm tencere', g: 2, rp: 0.4, ciro: 9, d: 'K' }
  ];
  V.BCG_AD = { Y: 'Yıldız', I: 'Nakit ineği', S: 'Soru işareti', K: 'Köpek' };
  V.BCG_STR = { Y: 'Yatırım yap, payı koru: büyüyen pazarın lideri; nakdi kendi tüketir.', I: 'Sağ ve koru: yavaş pazarda lider; nakdi diğer ürünlere aktar.', S: 'Seç: ya büyük yatırımla payı artır ya da çık; bekleyişte nakit yakar.', K: 'Hasat et ya da çık: küçük pay, durgun pazar.' };

  /* ---------------- ORGANİZASYON ---------------- */
  /* şirket türleri (6102 sayılı TTK; şahıs işletmesi vergi mevzuatında) */
  V.TUR = [
    { k: 'sahis', ad: 'Şahıs işletmesi', s: 'Tüzel kişiliği yok; işletme sahibi bütün borçlarından tüm malvarlığıyla sorumlu. Kazanç gelir vergisine tabi.' },
    { k: 'kolektif', ad: 'Kolektif şirket', s: 'Ortakları yalnızca gerçek kişiler; her ortak şirket borçlarından sınırsız ve müteselsil sorumlu.' },
    { k: 'komandit', ad: 'Komandit şirket', s: 'En az bir ortak sınırsız sorumlu (komandite), diğerleri koydukları sermayeyle sınırlı sorumlu (komanditer).' },
    { k: 'ltd', ad: 'Limited şirket', s: '1–50 ortak; asgari sermaye 50.000 TL; yönetim müdürlerde; esas sermaye payı devri yazılı yapılır, imzalar noterce onaylanır ve genel kurul onayı gerekir.' },
    { k: 'as', ad: 'Anonim şirket', s: 'Tek ortakla kurulabilir; asgari sermaye 250.000 TL (kayıtlı sermayede 500.000 TL); pay senedi çıkarabilir, halka arz edilebilir; yönetim kurulu yönetir.' }
  ];
  V.TUR_SORU = [
    ['Şirketi borsada halka arz etmek istiyoruz.', 'as'],
    ['Üç arkadaş, kişisel mal varlıkları risk altına girmesin istiyor; 50 ortağı geçmeyecekler, sermayeleri 60.000 TL.', 'ltd'],
    ['Tek başına kafe açıyorum; ayrı bir tüzel kişilik istemiyorum.', 'sahis'],
    ['Bir ortak hem yönetsin hem sınırsız sorumlu olsun; diğer ortak yalnızca para koysun.', 'komandit'],
    ['İki kardeş; her biri şirket borcunun tamamından şahsen sorumlu olmayı kabul ediyor.', 'kolektif'],
    ['Tek ortaklı, 300.000 TL sermayeli ve ileride yatırımcıya pay satmayı planlayan bir girişim.', 'as']
  ];
  /* yapılar: senaryo → uygun örgüt yapısı */
  V.YAPI = [
    { k: 'fonk', ad: 'Fonksiyonel', s: 'Üretim, pazarlama, finans gibi uzmanlık bölümleri. Tek ürünlü, istikrarlı şirket için verimli.' },
    { k: 'urun', ad: 'Bölümsel (ürün)', s: 'Her ürün grubunun kendi üretim ve pazarlaması var. Ürünler birbirinden çok farklıysa.' },
    { k: 'cog', ad: 'Bölümsel (coğrafi)', s: 'Bölge müdürlükleri: Türkiye, Avrupa, Orta Doğu. Pazarlar farklı davranıyorsa.' },
    { k: 'matris', ad: 'Matris', s: 'Çalışan hem fonksiyon yöneticisine hem proje yöneticisine bağlı. Proje odaklı, esneklik gereken işlerde; iki patron sorunu riski.' }
  ];
  V.YAPI_SORU = [
    ['Tek ürün (termos) üretiyoruz, 80 çalışanımız var, pazar istikrarlı.', 'fonk'],
    ['Termos, beyaz eşya yedek parçası ve tekstil: üç alakasız işimiz var.', 'urun'],
    ['Almanya, Irak ve Türkiye\'de satıyoruz; müşteriler ve yasalar çok farklı.', 'cog'],
    ['Mühendisler 6 aylık müşteri projelerinde çalışıp bitince bölümüne dönüyor.', 'matris']
  ];

  /* ---------------- ŞİRKET SİMÜLASYONU ---------------- */
  /* tutarlar TL; çeyrek bazında */
  V.SIM = {
    ceyrek: 8,
    pazar: 520000,          /* sektörün çeyreklik talebi (adet), çeyreklik %2 büyür */
    mevsim: [0.92, 1.08, 1.12, 0.88],
    rakipFiyat: 350,        /* rakiplerin ortalama fiyatı */
    rakipCekim: 4,          /* rakiplerin toplam çekim gücü (biz 1 iken ~%20 pay) */
    esneklik: 2.2,          /* fiyat esnekliği */
    malzeme: 120,           /* birim malzeme maliyeti */
    ucret: 90000,           /* işçi başına çeyreklik maliyet */
    isciVerim: 900,         /* işçi başına çeyreklik üretim */
    genel: 2800000,         /* genel yönetim gideri (çeyreklik) */
    amort: 0.025,           /* makinenin çeyreklik amortisman oranı */
    faiz: 0.36,             /* yıllık kredi faizi */
    acilFaiz: 0.60,         /* kasa eksiye düşerse otomatik açılan acil kredinin faizi */
    vergi: 0.25,
    depo: 0.02,             /* elde kalan stoğun çeyreklik taşıma maliyeti (depo, sigorta, fire) */
    hatKapasite: 55000,     /* bir üretim hattının çeyreklik kapasitesi */
    hatBedel: 30000000,
    acilis: { kasa: 9000000, alacak: 14000000, stokAdet: 18000, stokDeger: 3870000, makine: 60000000, hat: 2,
      satici: 4200000, vergi: 0, kredi: 30000000, acil: 0, sermaye: 45000000, birikmis: 7670000,
      isci: 120, fiyat: 340, marka: 1, kalite: 1 }
  };
  /* yönetim kurulu gündemi: her çeyrek bir madde; seçenek etkileri */
  V.GUNDEM = [
    { t: 'Zincir market %8 iskonto istiyor', ac: 'En büyük müşterimiz (cironun %35\'i) fiyatta %8 indirim istiyor; vermezsek başka tedarikçiye geçeceğini söylüyor.',
      g: { cfo: 'İskonto brüt marjı eritir; nakit zaten sıkışık.', coo: 'Kaybedersek fabrikada %20 boş kapasite kalır.', cmo: 'Alıcının pazarlık gücü yüksek (Porter); kaybetmek markaya da zarar.' },
      s: [{ l: 'iskontoyu ver', fx: { fiyatK: -0.03, talepK: 0.04 }, r: 'Müşteri kaldı; birim fiyatın bu yıl ortalama %3 düştü.' },
          { l: 'yarısını ver (%4)', fx: { fiyatK: -0.015, talepK: 0.01 }, r: 'Uzlaşma: müşteri hacmini biraz azalttı ama kaldı.' },
          { l: 'reddet', fx: { talepK: -0.12 }, r: 'Müşteri siparişlerinin büyük kısmını rakibe kaydırdı.' }] },
    { t: 'Kocaeli\'de yeni üretim hattı', ac: '30 mn TL\'lik yeni hat makine kapasitesini 55.000 adet artırır. NBD hesabı pozitif ama kredi gerekir.',
      g: { cfo: 'NBD +6 mn; ama %36 faizle kredi çekersek kasa 4 çeyrek baskı altında.', coo: 'Yoğun çeyreklerde siparişleri kaçırıyoruz. Yeni hattı çalıştırmak için 30–60 işçi daha gerekir.', cmo: 'Kamp ürünlerinde talep %20 büyüyor; ürün yetiştiremezsek pay kaybederiz.' },
      s: [{ l: 'onayla (kredili)', fx: { hat: 1, kredi: 30000000, capex: 30000000 }, r: 'Hat kuruldu ve kredi çekildi; kapasite arttı, faiz yükü de.' },
          { l: 'ertele', fx: {}, r: 'Yatırım ertelendi; kapasite aynı kaldı.' }] },
    { t: 'Grev uyarısı', ac: 'Sendika %25 ücret artışı istiyor. Teklifimiz %15.',
      g: { cfo: '%25 artış yıllık işçilik maliyetini 8 mn artırır.', coo: 'Grev olursa bir çeyrek üretim üçte bir düşer.', cmo: 'Uzun grev teslimatları aksatır, müşteri güveni sarsılır.' },
      s: [{ l: '%25\'i kabul et', fx: { ucretK: 0.25, verimK: 0.04 }, r: 'Anlaşma sağlandı; motivasyon arttı, verim %4 yükseldi.' },
          { l: '%20\'de uzlaş', fx: { ucretK: 0.20 }, r: 'Uzlaşma: üretim aksamadı.' },
          { l: '%15\'te ısrar et', fx: { ucretK: 0.15, grev: 1 }, r: 'Bir çeyrek grev yaşandı, üretim üçte bir düştü.' }] },
    { t: 'Akıllı matara Ar-Ge projesi', ac: '4 mn TL\'lik Ar-Ge harcaması; başarılı olursa iki çeyrek sonra markanın çekiciliği artar.',
      g: { cfo: 'Ar-Ge bu çeyrek gider; kâr düşer.', coo: 'Üretim hattında küçük bir uyarlama yeter.', cmo: 'BCG\'de "soru işareti": büyüyen pazar, bizim payımız küçük.' },
      s: [{ l: 'projeyi başlat', fx: { gider: 4000000, markaGec: 0.12 }, r: 'Ar-Ge başladı; etkisini iki çeyrek sonra göreceksin.' },
          { l: 'reddet', fx: {}, r: 'Proje rafa kalktı.' }] },
    { t: 'Kur şoku: çelik %18 zamlandı', ac: 'Döviz yükseldi; ithal paslanmaz çelik fiyatı %18 arttı.',
      g: { cfo: 'Maliyeti fiyata yansıtmazsak marj erir.', coo: '3 aylık stok yapabiliriz ama nakit bağlanır.', cmo: 'Rakipler de etkilendi; fiyat artışını müşteri anlayışla karşılayabilir.' },
      s: [{ l: 'fiyata yansıt (+%8)', fx: { malzemeK: 0.18, fiyatEk: 0.08 }, r: 'Maliyet arttı, fiyatını da %8 artırdın.' },
          { l: 'maliyeti üstlen', fx: { malzemeK: 0.18 }, r: 'Fiyat aynı kaldı, marj daraldı.' },
          { l: 'yerli tedarikçiye geç', fx: { malzemeK: 0.08, kaliteK: -0.04 }, r: 'Yerli tedarikle maliyet daha az arttı; kalite biraz düştü.' }] },
    { t: 'Fuar ve dijital reklam kampanyası', ac: 'Pazarlama 3 mn TL\'lik kampanya öneriyor.',
      g: { cfo: 'Getirisi ölçülebilir olsun; kasa ne durumda?', coo: 'Ek talebi karşılayacak kapasite var mı, bak.', cmo: 'Bilinirliği ölçüyoruz; pay 1–2 puan artabilir.' },
      s: [{ l: 'kampanyayı yap', fx: { gider: 3000000, marka: 0.07 }, r: 'Kampanya yapıldı; marka çekiciliği arttı.' },
          { l: 'yarı bütçeyle', fx: { gider: 1500000, marka: 0.03 }, r: 'Küçük kampanya, küçük etki.' },
          { l: 'yapma', fx: {}, r: 'Kampanya yapılmadı.' }] },
    { t: 'Kredi refinansmanı', ac: 'Banka, borcun 20 mn\'ını %30 faizle yeniden yapılandırmayı teklif ediyor; 1 mn dosya masrafı var.',
      g: { cfo: 'Faiz 6 puan düşer: yılda 1,2 mn tasarruf, 1 mn masraf.', coo: 'Operasyonu etkilemez.', cmo: 'Etkisi yok.' },
      s: [{ l: 'kabul et', fx: { gider: 1000000, faizYeni: 0.30 }, r: 'Borç yeniden yapılandırıldı; faiz %30\'a indi.' },
          { l: 'reddet', fx: {}, r: 'Eski faizle devam.' }] },
    { t: 'Kâr payı dağıtımı', ac: 'Ortaklar yıl sonu kârının bir kısmının nakit olarak dağıtılmasını istiyor.',
      g: { cfo: 'Dağıtırsak kasa ve özkaynak azalır; borç/özkaynak yükselir.', coo: 'Yatırım için iç kaynak kalmaz.', cmo: 'Ortakların memnuniyeti şirkete güveni artırır.' },
      s: [{ l: 'kârın %50\'si', fx: { temettu: 0.5 }, r: 'Kârın yarısı ortaklara dağıtıldı.' },
          { l: 'kârın %20\'si', fx: { temettu: 0.2 }, r: 'Kârın beşte biri dağıtıldı.' },
          { l: 'dağıtma', fx: {}, r: 'Kâr şirkette bırakıldı (otofinansman).' }] }
  ];

  window.AXSK = V;
})();
