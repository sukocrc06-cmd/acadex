/* ==========================================================================
   ACADEX KLİNİK · Hemşirelik Lab senaryoları (labs/klinik/senaryo-hemsirelik.js), 01.11.2026
   Acadex Medica 7. kat (dahiliye servisi): Hemşirelik Lab vaka masasındaki 8 vaka
   (hem-veri.js → VAKA) için sahne: yatak başında karşılama → hemşirelik anamnezi →
   gözlem ve ölçüm → öncelik kararı → vaka masasına devir (değerlendirme → hemşirelik
   tanısı → girişimler). Hasta adı ve yaşı vaka dosyasıyla AYNIDIR.
   EĞİTİM AMAÇLIDIR; vakalar kurgusaldır.
   ========================================================================== */
(function (root, factory) {
  var L = factory();
  if (typeof module === 'object' && module.exports) module.exports = L;
  else if (root.AXKLINIK) root.AXKLINIK.ekle(L);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var HEM = { ad: 'Sevgi', unvan: 'Hem.', cins: 'K' };
  var S = function (id, t, cevap, puan, not, kim, geri) { return { id: id, t: t, cevap: cevap, puan: puan, not: not || null, kim: kim || null, geri: geri || null }; };
  var E = function (id, t, sonuc, puan, o) { return Object.assign({ id: id, t: t, sonuc: sonuc, puan: puan }, o || {}); };
  var K = function (baslik, soru, secenek) { return { tip: 'karar', baslik: baslik, soru: soru, secenek: secenek.map(function (x) { return { t: x[0], dogru: !!x[1], geri: x[2] }; }) }; };
  var MASA = function (metin) { return { tip: 'devir', metin: metin, dugme: 'Vaka masasına geç', hedef: 'vaka' }; };
  var YARGI = function (kim, t, cevap, geri) { return S('yargi', t, cevap, -2, null, kim, geri || 'Suçlayıcı soru hastanın güvenini sarsar; yakınmasını saklamaya başlar.'); };
  var ODA = 'servis', ODAAD = 'Dahiliye servisi, hasta odası';
  var VITAL = function (id) { return E('vital', 'Vital bulguları ölç, NEWS2 hesapla', id, 3, { anim: 'monitor' }); };

  return [
    { id: 'hem-pnomoni', muayene: { akciger: { sag: 'ral', sol: 'normal' } }, vaka: 'pnomoni', lab: 'hemsirelik', oda: ODA, odaAd: ODAAD, baslik: 'Gece nefes darlığı arttı',
      hasta: { ad: 'Rasim', hitap: 'Rasim Bey', yas: 76, cins: 'E', gorunum: 'yasli', poz: 'yat', uyanik: true, maske: true, ifade: 'endise' }, mentor: HEM, vital: { nabiz: 114, ta: '100/60', spo2: 91, ates: 38.7 },
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Hemşire hanım… nefesim yetmiyor… gece hiç uyuyamadım.' },
        { tip: 'sor', baslik: 'Hemşirelik anamnezi', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('nefes', 'Nefes darlığı ne zaman arttı, konuşurken zorlanıyor musunuz?', 'Gece yarısından beri… cümleyi bitiremiyorum.', 3, 'Solunum|Gece arttı; cümle bitiremiyor.'),
          S('balgam', 'Balgamınız var mı, rengi nasıl?', 'Sarı-yeşil, koyu.', 2, 'Balgam|Pürülan.'),
          S('gogus', 'Nefes alırken göğüs ağrısı var mı?', 'Derin nefeste batıyor.', 2, 'Ağrı|Plöretik ağrı.'),
          S('tv', 'Odada televizyon çalışıyor mu?', 'Bilmiyorum.', 0),
          YARGI('hasta', 'Gece neden zili çalmadınız?', 'Rahatsız etmek istemedim…')
        ] },
        { tip: 'eylem', baslik: 'Gözlem', yonerge: 'gerekenleri yap', secenek: [
          VITAL('Solunum 26/dk, SpO₂ %91 (2 L/dk), nabız 114, TA 100/60, ateş 38,7 °C, uyanık: NEWS2 = 13.'),
          E('efor', 'Solunum eforunu gözle', 'Boyun kasları çalışıyor, burun kanatları açılıyor.', 2),
          E('duz', 'Rahat uyusun diye yatağı düzle', 'SpO₂ %88’e düştü.', -3, { vital: { spo2: 88 }, alarm: { spo2: true }, ifade: 'agri', geri: 'Düz yatmak solunumu zorlaştırır; yarı oturur pozisyon gerekir.' })
        ] },
        K('Ne yaparsın?', 'NEWS2 = 13, solunum giderek zorlaşıyor.', [
          ['Yarı oturur pozisyon verip oksijeni sürdürür, hekime ve acil müdahale ekibine hemen haber veririm', true, 'Doğru. NEWS2 ≥7 acil müdahale ekibini gerektirir; ilk destek pozisyon ve istemdeki oksijendir.'],
          ['Bir saat sonra yeniden ölçerim', false, 'Yüksek skorda beklemek kötüleşmeyi kaçırır.'],
          ['Oksijeni kendim 10 L/dk’ya çıkarırım ve kimseye söylemem', false, 'Oksijen istemle verilir; asıl gereken acil bildirimdir.']
        ]),
        MASA('Vaka masasında değerlendirmeyi seç, hemşirelik tanını ve girişimlerini yaz.')
      ] },

    { id: 'hem-postop', vaka: 'postop', lab: 'hemsirelik', oda: ODA, odaAd: ODAAD, baslik: 'Ameliyat sonrası ağrı',
      hasta: { ad: 'Gülay', hitap: 'Gülay Hanım', yas: 54, cins: 'K', gorunum: 'yetiskin', poz: 'yat', uyanik: true, ifade: 'agri' }, mentor: HEM, vital: { nabiz: 92, ta: '134/82', spo2: 97 },
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Karnım çok ağrıyor; öksürmeye, kalkmaya korkuyorum.' },
        { tip: 'sor', baslik: 'Hemşirelik anamnezi', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('agri', 'Ağrınızı 0 ile 10 arasında puanlasanız kaç?', 'Yatarken 7, öksürünce 9.', 3, 'Ağrı|7/10, öksürünce 9/10.'),
          S('ilac', 'En son ne zaman ağrı kesici aldınız?', 'Gece 2’de bir iğne yapıldı.', 3, 'Analjezi|Son doz 02:00.'),
          S('gaz', 'Gaz çıkardınız mı, bulantınız var mı?', 'Gaz çıkardım, bulantım yok.', 2, 'GİS|Gaz var, bulantı yok.'),
          S('ziyaret', 'Bugün ziyaretçiniz gelecek mi?', 'Kızım gelecek.', 0),
          YARGI('hasta', 'Bu kadar küçük bir ameliyat için çok abartmıyor musunuz?', 'Ama gerçekten ağrıyor…')
        ] },
        { tip: 'eylem', baslik: 'Gözlem', yonerge: 'gerekenleri yap', secenek: [
          VITAL('Nabız 92, TA 134/82, SpO₂ %97, solunum 18, ateş 37,3 °C: NEWS2 = 1.'),
          E('insizyon', 'İnsizyonlara ve pansumana bak', 'Pansumanlar kuru, kızarıklık yok.', 2),
          E('bekle', 'Ağrı kesiciyi akşam vizitine bırak', 'Gülay Hanım yüzünü buruşturdu.', -2, { ifade: 'agri', geri: 'Kontrol edilmeyen ağrı solunumu ve mobilizasyonu engeller.' })
        ] },
        K('Ne yaparsın?', 'İstemde düzenli ve gerektiğinde analjezik var.', [
          ['İstemdeki analjeziği uygular, 30–60 dakika sonra ağrıyı yeniden puanlarım; öksürürken yastıkla desteklemeyi gösteririm', true, 'Doğru. Ölç–uygula–yeniden ölç döngüsü ve basit tekniklerle ağrı kontrol edilir.'],
          ['Ağrının geçmesini beklemesini söylerim', false, 'Ağrıyı yönetmek hemşirenin bağımsız sorumluluğudur.'],
          ['Hareket etmemesini, yatakta kalmasını öneririm', false, 'Hareketsizlik tromboz ve akciğer komplikasyonu riskini artırır.']
        ]),
        MASA('Vaka masasında değerlendirmeyi seç, hemşirelik tanını ve girişimlerini yaz.')
      ] },

    { id: 'hem-sepsis', vaka: 'sepsis', lab: 'hemsirelik', oda: ODA, odaAd: ODAAD, baslik: 'Annem beni tanımadı',
      hasta: { ad: 'Saniye', hitap: 'Saniye Hanım', yas: 70, cins: 'K', gorunum: 'yasli', poz: 'yat', uyanik: true, konusamaz: true, ifade: 'endise' }, refakat: { ad: 'Kızı', cins: 'K', gorunum: 'yetiskin', kiyafet: '#3B7DD8', ifade: 'endise' }, mentor: HEM, vital: { nabiz: 120, ta: '90/52', spo2: 95, ates: 39.4 },
      adimlar: [
        { tip: 'konus', kim: 'refakat', metin: 'Bu sabah annem beni tanımadı. Dünden beri tuvalete de az çıkıyor, titriyor.' },
        { tip: 'sor', baslik: 'Yakınıyla görüşme', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('bilinc', 'Karışıklık ne zaman başladı, daha önce böyle olmuş muydu?', 'Bu sabah başladı; hiç böyle olmamıştı.', 3, 'Bilinç|Yeni konfüzyon (bu sabah).', 'refakat'),
          S('idrar', 'En son ne zaman ve ne kadar idrar yaptı?', 'Dün akşamdan beri çok az, rengi koyu.', 3, 'Boşaltım|Oligüri, koyu idrar.', 'refakat'),
          S('ates', 'Ateşi ne zamandır var?', 'Dün öğleden beri.', 2, 'Ateş|Dünden beri.', 'refakat'),
          S('torun', 'Torunları var mı?', 'Üç tane.', 0, null, 'refakat'),
          YARGI('refakat', 'Neden bu kadar geç getirdiniz?', 'Biz… idrar yolu sandık…')
        ] },
        { tip: 'eylem', baslik: 'Gözlem', yonerge: 'gerekenleri yap', secenek: [
          VITAL('TA 90/52, nabız 120, solunum 23, SpO₂ %95, ateş 39,4 °C, yeni konfüzyon: NEWS2 = 13.'),
          E('sonda', 'Saatlik idrar çıkışını ölçmeye başla', 'Son bir saatte 15 ml.', 2),
          E('battaniye', 'Titriyor diye üç battaniye ört ve beklet', 'Ateş 39,8 °C’ye çıktı.', -2, { vital: { ates: 39.8 }, geri: 'Örtmek ateşi yükseltir; asıl gereken acil değerlendirmedir.' })
        ] },
        K('Ne yaparsın?', 'Hipotansiyon, taşikardi, ateş ve yeni konfüzyon.', [
          ['Hekime ve acil müdahale ekibine hemen haber verir, istemle kültür, laktat, sıvı ve antibiyotiğin gecikmeden başlamasını sağlarım', true, 'Doğru. Sepsiste ilk saat kritik; hemşire tanır, bildirir ve paketi hızla uygular.'],
          ['Sabah vizitine kadar izlerim', false, 'Sepsiste her saatlik gecikme ölüm riskini artırır.'],
          ['Ateş düşürücü verip uyumasını beklerim', false, 'Ateşi düşürmek sepsisi tedavi etmez.']
        ]),
        MASA('Vaka masasında değerlendirmeyi seç, hemşirelik tanını ve girişimlerini yaz.')
      ] },

    { id: 'hem-hipogl', vaka: 'hipogl', lab: 'hemsirelik', oda: ODA, odaAd: ODAAD, baslik: 'Terleme ve titreme',
      hasta: { ad: 'Kemal', hitap: 'Kemal Bey', yas: 66, cins: 'E', gorunum: 'yasli', poz: 'yat', uyanik: true, ifade: 'endise' }, mentor: HEM, vital: { nabiz: 102, ta: '138/84', spo2: 98 },
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Bir tuhaf oldum… ellerim titriyor, ter içindeyim.' },
        { tip: 'sor', baslik: 'Hemşirelik anamnezi', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('ogun', 'Kahvaltınızı yediniz mi?', 'Yiyemedim, midem bulanıyordu.', 3, 'Beslenme|Kahvaltı yememiş.'),
          S('insulin', 'Sabah insülininizi yaptılar mı?', 'Evet, saat 8’de.', 3, 'İnsülin|08:00’de 10 ünite.'),
          S('once', 'Daha önce şekeriniz düştü mü, nasıl anlarsınız?', 'Bir kez; böyle terlemiştim.', 2, 'Öykü|Önceki hipoglisemi.'),
          S('gazete', 'Gazete ister misiniz?', 'Şimdi değil.', 0),
          YARGI('hasta', 'Neden kahvaltınızı yemediniz, kurallara uymuyorsunuz?', 'Midem bulanıyordu…')
        ] },
        { tip: 'eylem', baslik: 'Gözlem', yonerge: 'gerekenleri yap', secenek: [
          E('ks', 'Parmak ucu kan şekerini ölç', 'Kan şekeri 52 mg/dL.', 3),
          E('bilinc', 'Bilincini ve yutabildiğini değerlendir', 'Uyanık, sorulara yanıt veriyor, yutabiliyor.', 2),
          E('insulin2', 'Öğle insülinini erken uygula', 'Kemal Bey’in terlemesi arttı.', -3, { ifade: 'agri', geri: 'Hipoglisemide insülin vermek tabloyu ağırlaştırır.' })
        ] },
        K('Ne yaparsın?', 'Kan şekeri 52 mg/dL, bilinci açık.', [
          ['15 g hızlı etkili karbonhidrat verir, 15 dakika sonra yeniden ölçer ve hekime bildiririm', true, 'Doğru. 15-15 kuralı; bilinci açık ve yutabilen hastada ağızdan verilir.'],
          ['Öğle yemeğini bekletirim', false, 'Hipoglisemi dakikalar içinde ağırlaşabilir.'],
          ['Hemen damardan insülin veririm', false, 'İnsülin kan şekerini daha da düşürür.']
        ]),
        MASA('Vaka masasında değerlendirmeyi seç, hemşirelik tanını ve girişimlerini yaz.')
      ] },

    { id: 'hem-dusme', vaka: 'dusme', lab: 'hemsirelik', oda: ODA, odaAd: ODAAD, baslik: 'Gece tek başına kalktı',
      hasta: { ad: 'Münevver', hitap: 'Münevver Hanım', yas: 82, cins: 'K', gorunum: 'yasli', poz: 'yat', uyanik: true }, mentor: HEM, vital: { nabiz: 84, ta: '148/86', spo2: 95 },
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Gece tuvalete gitmek istedim, kimseyi rahatsız etmeyeyim dedim.' },
        { tip: 'sor', baslik: 'Hemşirelik anamnezi', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('dusmeoyku', 'Son bir yılda düştünüz mü?', 'Evde iki kez düştüm.', 3, 'Düşme|Son bir yılda iki kez.'),
          S('idrar', 'Geceleri kaç kez tuvalete kalkıyorsunuz?', 'Üç dört kez; idrar söktürücü kullanıyorum.', 3, 'Boşaltım|Noktüri, diüretik.'),
          S('gorme', 'Gözlüğünüz yanınızda mı, iyi görüyor musunuz?', 'Gözlüğüm çantada kaldı.', 2, 'Görme|Gözlük uzakta.'),
          S('yemek', 'Hastane yemeğini beğendiniz mi?', 'Tuzsuz.', 0),
          YARGI('hasta', 'Neden kurallara uymayıp tek başınıza kalktınız?', 'Kusura bakmayın…')
        ] },
        { tip: 'eylem', baslik: 'Gözlem', yonerge: 'gerekenleri yap', secenek: [
          E('skor', 'Düşme riski skorunu hesapla', 'Yüksek risk.', 3),
          E('ortam', 'Ortamı kontrol et', 'Yatak yüksek, zil uzakta, gece ışığı kapalı.', 2),
          E('bagla', 'Kalkmasın diye bileklerini bağla', 'Münevver Hanım ağlamaya başladı.', -3, { ifade: 'uzgun', geri: 'Fiziksel kısıtlama düşmeyi önlemez, yaralanmayı ve deliryumu artırabilir.' })
        ] },
        K('Ne yaparsın?', 'Düşme riski yüksek.', [
          ['Yatağı alçaltıp frenleri kilitler, zili ve gözlüğü yanına koyar, gece ışığı ve düzenli tuvalet planı yaparım', true, 'Doğru. Ortam ve ihtiyaç düzenlemesi düşmeyi önlemenin temelidir.'],
          ['Yatak kenarlıklarını kaldırıp geceyi bekleriz', false, 'Kenarlığın üzerinden tırmanmak daha yüksekten düşmeye yol açabilir; tek başına çözüm değildir.'],
          ['Uyku ilacı verilmesini isterim', false, 'Sedasyon düşme riskini artırır.']
        ]),
        MASA('Vaka masasında değerlendirmeyi seç, hemşirelik tanını ve girişimlerini yaz.')
      ] },

    { id: 'hem-basi', vaka: 'basi', lab: 'hemsirelik', oda: ODA, odaAd: ODAAD, baslik: 'Sakrumda açık yara',
      hasta: { ad: 'Ziya', hitap: 'Ziya Bey', yas: 84, cins: 'E', gorunum: 'yasli', poz: 'yat', uyanik: true }, refakat: { ad: 'Oğlu', cins: 'E', gorunum: 'yetiskin', kiyafet: '#46506A' }, mentor: HEM, vital: { nabiz: 72, ta: '118/70', spo2: 95 },
      adimlar: [
        { tip: 'konus', kim: 'refakat', metin: 'Babamın kuyruk sokumunda yara açılmış, evde fark etmemişiz.' },
        { tip: 'sor', baslik: 'Görüşme', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('pozisyon', 'Evde ne sıklıkla pozisyonunu değiştiriyordunuz?', 'Gece pek çeviremiyorduk.', 3, 'Pozisyon|Gece çevrilmiyor.', 'refakat'),
          S('beslenme', 'Yemek ve su içmesi nasıl?', 'Çok az yiyor, su istemiyor.', 3, 'Beslenme|Alım az.', 'refakat'),
          S('inkontinans', 'İdrar ya da dışkı kaçırması oluyor mu?', 'Bazen bezini ıslatıyor.', 2, 'Nem|İdrar inkontinansı.', 'refakat'),
          S('futbol', 'Babanız maç izler mi?', 'Eskiden çok izlerdi.', 0, null, 'refakat'),
          YARGI('refakat', 'Nasıl oldu da bunu fark etmediniz?', 'Biz… çok yorgunduk…')
        ] },
        { tip: 'eylem', baslik: 'Gözlem', yonerge: 'gerekenleri yap', secenek: [
          E('evre', 'Yarayı ölç ve evrele', '3 × 2 cm, kısmi kalınlıkta açık yara (evre 2), akıntı az.', 3),
          E('braden', 'Braden skorunu hesapla', 'Braden 12: yüksek risk.', 2),
          E('masaj', 'Kızarık çevre deriye masaj yap', 'Deri daha da kızardı.', -2, { geri: 'Masaj basınç altındaki dokuyu daha da zedeler.' })
        ] },
        K('Ne yaparsın?', 'Evre 2 bası yarası, Braden 12.', [
          ['Basıncı kaldırırım: 2 saatte bir pozisyon, basınç azaltıcı yatak; yarayı aseptik teknikle bakarım; beslenmeyi değerlendirtirim', true, 'Doğru. Basınç, nem ve beslenme birlikte yönetilir.'],
          ['Yarayı açık bırakıp kurumasını beklerim', false, 'Nemli yara iyileşmesi daha hızlıdır; uygun örtü gerekir.'],
          ['Halka simit kullanırım', false, 'Halka şeklindeki yastıklar çevre dokuda basıncı artırır.']
        ]),
        MASA('Vaka masasında değerlendirmeyi seç, hemşirelik tanını ve girişimlerini yaz.')
      ] },

    { id: 'hem-transf', vaka: 'transf', lab: 'hemsirelik', oda: ODA, odaAd: ODAAD, baslik: 'Kan verilirken titreme',
      hasta: { ad: 'Leyla', hitap: 'Leyla Hanım', yas: 61, cins: 'K', gorunum: 'yetiskin', poz: 'yat', uyanik: true, ifade: 'agri' }, mentor: HEM, vital: { nabiz: 122, ta: '96/58', spo2: 96, ates: 38.9 },
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Üşüyorum… belim çok ağrıyor. Kan başladığından beri böyle.' },
        { tip: 'sor', baslik: 'Hemşirelik anamnezi', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('zaman', 'Belirtiler kan başladıktan ne kadar sonra başladı?', 'On beş dakika kadar sonra.', 3, 'Başlangıç|15. dakika.'),
          S('nefes', 'Nefes darlığı ya da göğüs sıkışması var mı?', 'Biraz sıkışma var.', 3, 'Solunum|Göğüste sıkışma.'),
          S('once', 'Daha önce kan aldınız mı, bir şey oldu mu?', 'İlk kez alıyorum.', 2, 'Öykü|İlk transfüzyon.'),
          S('kitap', 'Ne okuyorsunuz?', 'Bir roman.', 0),
          YARGI('hasta', 'Biraz dayansanız bitecek, değil mi?', 'Dayanamıyorum…')
        ] },
        { tip: 'eylem', baslik: 'İlk adım', yonerge: 'gerekenleri yap', secenek: [
          E('durdur', 'Transfüzyonu hemen durdur', 'Torba klemplendi; damar yolu açık.', 3),
          VITAL('Ateş 38,9 °C, nabız 122, TA 96/58, SpO₂ %96: NEWS2 = 6.'),
          E('yavas', 'Hızı azaltıp devam et', 'Leyla Hanım’ın titremesi arttı.', -3, { vital: { nabiz: 130 }, alarm: { nabiz: true }, geri: 'Reaksiyonda ilk ve kesin adım transfüzyonu durdurmaktır.' })
        ] },
        K('Sonra ne yaparsın?', 'Transfüzyon durduruldu.', [
          ['Damar yolunu serum fizyolojikle açık tutar, hekime ve kan bankasına bildirir, torbayı ve seti saklar, kimlik kontrolünü yeniden yaparım', true, 'Doğru. Ürün ve set incelenmek üzere saklanır; kimlik kontrolü hata olasılığını araştırır.'],
          ['Torbayı ve seti hemen atarım', false, 'Ürün incelenmek üzere saklanmalıdır.'],
          ['Ateş düşürücü verip transfüzyonu yeniden başlatırım', false, 'Hemolitik reaksiyon şüphesinde transfüzyon yeniden başlatılmaz.']
        ]),
        MASA('Vaka masasında değerlendirmeyi seç, hemşirelik tanını ve girişimlerini yaz.')
      ] },

    { id: 'hem-kky', muayene: { akciger: { sag: 'ral', sol: 'ral' }, kalp: { tip: 'normal' } }, vaka: 'kky', lab: 'hemsirelik', oda: ODA, odaAd: ODAAD, baslik: 'Bir günde iki kilo',
      hasta: { ad: 'Nihat', hitap: 'Nihat Bey', yas: 78, cins: 'E', gorunum: 'yasli', poz: 'yat', uyanik: true }, mentor: HEM, vital: { nabiz: 98, ta: '142/90', spo2: 93 },
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Bacaklarım şişti, yatınca nefesim daralıyor. İki yastıkla ancak uyuyabildim.' },
        { tip: 'sor', baslik: 'Hemşirelik anamnezi', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('sivi', 'Dün ne kadar sıvı içtiniz, tuzlu bir şey yediniz mi?', 'Çok susadım, iki litreden fazla su içtim; turşu da yedim.', 3, 'Sıvı|>2 L sıvı, tuzlu besin.'),
          S('idrar', 'İdrar miktarınızda değişiklik var mı?', 'Azaldı gibi.', 3, 'Boşaltım|Azalmış.'),
          S('ilac', 'Ödem ilacınızı içtiniz mi?', 'Dün öğlen içmeyi unuttum.', 2, 'İlaç|Diüretik dozu atlanmış.'),
          S('hobi', 'Hobiniz var mı?', 'Bahçecilik.', 0),
          YARGI('hasta', 'Size tuz yemeyin denmemiş miydi?', 'Dendi ama…')
        ] },
        { tip: 'eylem', baslik: 'Gözlem', yonerge: 'gerekenleri yap', secenek: [
          E('tarti', 'Aynı tartıyla tart', 'Dünkü tartıya göre +2 kg.', 3),
          E('io', 'Aldığı-çıkardığı sıvıyı hesapla', 'Aldığı 2200 ml, çıkardığı 900 ml.', 3),
          E('su', 'Susadığı için sürahi dolusu su ver', 'Nihat Bey’in nefes darlığı arttı.', -2, { vital: { spo2: 91 }, alarm: { spo2: true }, geri: 'Sıvı yüklenmesinde sıvı kısıtlaması istemine uyulur.' })
        ] },
        K('Ne yaparsın?', '+2 kg, pozitif sıvı dengesi, SpO₂ %93.', [
          ['Yarı oturur pozisyon verir, aldığı-çıkardığını izler ve kilo artışını hekime bildiririm', true, 'Doğru. 1–2 günde 2 kg artış hekime bildirilir; diüretik planı yeniden değerlendirilir.'],
          ['Bol su içmesini öneririm', false, 'Sıvı yüklenmesini artırır.'],
          ['Düz yatırırım', false, 'Düz yatmak ortopneyi kötüleştirir.']
        ]),
        MASA('Vaka masasında değerlendirmeyi seç, hemşirelik tanını ve girişimlerini yaz.')
      ] }
  ];
});
