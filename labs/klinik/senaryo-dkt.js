/* ==========================================================================
   ACADEX KLİNİK · DKT Lab senaryoları (labs/klinik/senaryo-dkt.js), 31.10.2026
   DKT Lab klinik vaka masasındaki 6 vaka (dkt-veri.js → VAKA) için Acadex Medica sahnesi:
   karşılama → aile / hasta görüşmesi → kısa gözlem → danışmanlık ya da güvenlik kararı →
   vaka masasına devir (hedef 'vaka': değerlendirme seç → tanısal izlenim → terapi).
   Hasta adı, yaşı ve başvuru yakınması vaka dosyasıyla AYNIDIR (tests/medica.js denetler).
   Sahnedeki karar tanısal izlenimi söylemez; o, vaka masasında puanlanır.
   EĞİTİM AMAÇLIDIR; vakalar kurgusaldır.
   ========================================================================== */
(function (root, factory) {
  var L = factory();
  if (typeof module === 'object' && module.exports) module.exports = L;
  else if (root.AXKLINIK) root.AXKLINIK.ekle(L);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var DKT = { ad: 'Defne', unvan: 'DKT', cins: 'K' };
  var S = function (id, t, cevap, puan, not, kim, geri) { return { id: id, t: t, cevap: cevap, puan: puan, not: not || null, kim: kim || null, geri: geri || null }; };
  var E = function (id, t, sonuc, puan, o) { return Object.assign({ id: id, t: t, sonuc: sonuc, puan: puan }, o || {}); };
  var K = function (baslik, soru, secenek) { return { tip: 'karar', baslik: baslik, soru: soru, secenek: secenek.map(function (x) { return { t: x[0], dogru: !!x[1], geri: x[2] }; }) }; };
  var MASA = function (metin) { return { tip: 'devir', metin: metin, dugme: 'Vaka masasına geç', hedef: 'vaka' }; };
  var YARGI = function (kim, t, cevap, geri) { return S('yargi', t, cevap, -2, null, kim, geri || 'Suçlayıcı ya da küçümseyen soru güveni sarsar ve bilgi akışını keser.'); };

  return [
    /* ------------------------------ Fonolojik bozukluk ------------------------------ */
    { id: 'dkt-ssd', vaka: 'ssd', lab: 'dkt', oda: 'dkt', odaAd: 'Çocuk dil ve konuşma odası', baslik: '“Kedi” yerine “tedi” diyor',
      hasta: { ad: 'Ege', hitap: 'Ege', yas: '4 yaş 6 ay', cins: 'E', gorunum: 'cocuk', sac: '#3A2A1E', kiyafet: '#E0A526' }, refakat: { ad: 'Annesi', cins: 'K', gorunum: 'yetiskin', kiyafet: '#2E8E7E' }, mentor: DKT,
      adimlar: [
        { tip: 'konus', kim: 'refakat', metin: '“Kedi” yerine “tedi”, “gel” yerine “del” diyor. Yabancılar ne dediğini zor anlıyor.' },
        { tip: 'konus', kim: 'hasta', metin: 'Bak, bu benim tamyonum!' },
        { tip: 'sor', baslik: 'Aile görüşmesi', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('gelisim', 'Doğumu ve yürüme, ilk sözcük gibi gelişim basamakları nasıldı?', 'Normal doğum. Zamanında yürüdü, bir yaşında ilk sözcüklerini söyledi.', 3, 'Gelişim|Doğum ve motor gelişim normal.', 'refakat'),
          S('kulak', 'Sık kulak iltihabı geçirdi mi, işitmesinden şüphelendiniz mi?', 'Hayır, kulak iltihabı hiç olmadı. Fısıldasam bile duyar.', 3, 'İşitme|Sık otit öyküsü yok.', 'refakat'),
          S('anlama', 'Söylediklerinizi anlıyor mu, yönergeleri yerine getiriyor mu?', 'Her şeyi anlıyor, iki üç basamaklı işleri bile yapıyor.', 3, 'Dil anlama|Yaşına uygun.', 'refakat'),
          S('arkadas', 'Anaokulunda arkadaşlarıyla oynuyor mu?', 'Evet, çok sosyal.', 1, 'Sosyal|Arkadaşlarıyla oynuyor.', 'refakat'),
          S('tv', 'Günde ne kadar ekrana bakıyor?', 'Bir saat kadar.', 0, null, 'refakat'),
          YARGI('refakat', 'Onunla yeterince konuşmuyor musunuz?', 'Konuşuyoruz… çok konuşuyoruz.')
        ] },
        { tip: 'eylem', baslik: 'Gözlem', yonerge: 'oyun içinde gözle', secenek: [
          E('resim', 'Resimli kartlarla birkaç sözcük adlandırt', '“Kedi” → “tedi”, “göz” → “döz”, “bakkal” → “battal”. Diğer sesler yerinde.', 3),
          E('taklit', '“k” sesini tek başına taklit ettir', 'Aynayla bakınca “kkk” sesini tek başına doğru çıkarıyor.', 3, { geri: 'Sesi tek başına üretebilmesi motor değil sesbilgisel (kural) bir sorunu düşündürür.' }),
          E('oral', 'Dil, dudak ve damak hareketlerine bak', 'Yapı ve hareketler normal.', 2),
          E('duzelt', 'Her yanlışta “öyle değil, kedi de!” diye düzelt', 'Ege sustu, kartları bıraktı.', -2, { geri: 'Sürekli düzeltmek çocuğu konuşmaktan kaçırır; doğru modeli sunmak yeterlidir.' })
        ] },
        K('Aileye danışmanlık', 'Anne soruyor: “Yanlış söyleyince düzeltip tekrar ettireyim mi?”', [
          ['Düzeltip tekrar ettirmeyin; doğru biçimi doğal olarak yineleyin (“Evet, kedi geldi!”) ve iletişimi sürdürün', true, 'Doğru. Model sunmak çocuğa baskı yapmadan doğru biçimi duyurur; terapi programıyla birlikte aileye düşen rol budur.'],
          ['Her yanlışta durdurup beş kez doğru söyletin', false, 'Baskı, konuşma isteğini azaltır; terapi dışı zorlamalar ters etki yapabilir.'],
          ['Hiçbir şey yapmayın, okula başlayınca düzelir', false, 'Tutarlı bir ses örüntüsü ve anlaşılırlık sorunu varsa değerlendirme ve müdahale gerekir.']
        ]),
        MASA('Vaka masasında değerlendirmeleri seç, bulguları oku; tanısal izlenimini ve terapi planını yaz.')
      ] },

    /* ------------------------------ Gelişimsel kekemelik ------------------------------ */
    { id: 'dkt-kek', vaka: 'kek', lab: 'dkt', oda: 'dkt', odaAd: 'Akıcılık polikliniği', baslik: 'Sözcük başında takılmalar',
      hasta: { ad: 'Zeynep', hitap: 'Zeynep', yas: '4 yaş', cins: 'K', gorunum: 'cocuk', sac: '#5A3A22', kiyafet: '#C9DDF6' }, refakat: { ad: 'Babası', cins: 'E', gorunum: 'yetiskin', kiyafet: '#4E7AA8' }, mentor: DKT,
      adimlar: [
        { tip: 'konus', kim: 'refakat', metin: 'Sekiz aydır “ba-ba-ba-baba” gibi tekrarlıyor, sözcüğün başında takılıyor. Son haftalarda göz de kırpmaya başladı.' },
        { tip: 'konus', kim: 'hasta', metin: 'B-b-b-ben de… ben de resim yaptım.' },
        { tip: 'sor', baslik: 'Aile görüşmesi', hak: 3, yonerge: 'risk etkenlerini yakala', secenek: [
          S('sure', 'Takılmalar ne zaman başladı?', 'Sekiz ay önce başladı, geçmedi.', 3, 'Süre|8 ay (>6 ay).', 'refakat'),
          S('aile', 'Ailede kekemelik olan var mı?', 'Ben çocukken kekeliyormuşum.', 3, 'Aile|Babada çocuklukta kekemelik.', 'refakat'),
          S('fark', 'Zeynep takılmasının farkında mı, bir şey söylüyor mu?', 'Bazen “ben konuşamıyorum” diyor, üzülüyor.', 3, 'Farkındalık|“Konuşamıyorum” diyor.', 'refakat'),
          S('heyecan', 'Hangi durumlarda artıyor?', 'Heyecanlanınca, bir şey anlatmak isteyince artıyor.', 2, 'Durum|Heyecanla artıyor.', 'refakat'),
          S('kardes', 'Kardeşi var mı?', 'Yok, tek çocuk.', 0, null, 'refakat'),
          YARGI('refakat', 'Onu çok mu sıkıştırıyorsunuz da böyle oldu?', 'Hayır… öyle mi düşünüyorsunuz?', 'Kekemelik ailenin hatası değildir; suçluluk duygusu ailenin terapiye katılımını zorlaştırır.')
        ] },
        { tip: 'eylem', baslik: 'Gözlem', yonerge: 'oyun içinde gözle', secenek: [
          E('ornek', 'Oyun sırasında konuşma örneği kaydet', 'Kayıtta ses ve hece tekrarları, uzatmalar, ara ara bloklar var.', 3),
          E('eslik', 'Takılma sırasında yüzünü ve bedenini gözle', 'Takılmalarda göz kırpma eşlik ediyor.', 3),
          E('sakin', 'Yavaş ve sakin konuşarak, sözünü kesmeden dinle', 'Zeynep rahatladı, uzun bir hikâye anlattı.', 2, { geri: 'Sakin konuşma hızı ve sabırlı dinleme iletişimi kolaylaştırır.' }),
          E('tamamla', 'Takıldığında cümlesini onun yerine tamamla', 'Zeynep sustu, gözlerini kaçırdı.', -2, { geri: 'Cümleyi tamamlamak konuşma hakkını elinden alır ve kaygıyı artırır.' })
        ] },
        K('Aileye danışmanlık', 'Babası soruyor: “Çocuklarda geçermiş, bekleyelim mi?”', [
          ['Altı aydan uzun sürmesi, ailede kekemelik, eşlik eden davranış ve farkındalık riskleri artırıyor; beklemek yerine ayrıntılı değerlendirme ve müdahale planlayalım', true, 'Doğru. Bu risk etkenleri kendiliğinden geçme olasılığını azaltır; okul öncesi dönem müdahale için en verimli zamandır.'],
          ['Evet, kesinlikle geçer; okula kadar bekleyin', false, 'Risk etkenleri olan çocukta beklemek müdahale fırsatını kaçırabilir.'],
          ['“Yavaş konuş, nefes al” diyerek her takıldığında uyarın', false, 'Sürekli uyarı çocuğun konuşmaya odaklanmasını ve kaygısını artırır.']
        ]),
        MASA('Vaka masasında değerlendirmeleri seç, bulguları oku; tanısal izlenimini ve terapi planını yaz.')
      ] },

    /* ------------------------------ Afazi ------------------------------ */
    { id: 'dkt-afazi', vaka: 'afazi', lab: 'dkt', oda: 'dkt', odaAd: 'İnme rehabilitasyonu', baslik: 'İnme sonrası “sözcükler çıkmıyor”',
      hasta: { ad: 'Hasan Bey', hitap: 'Hasan Bey', yas: '62 yaş', cins: 'E', gorunum: 'yasli', kiyafet: '#6B7FA8', ifade: 'uzgun' }, refakat: { ad: 'Eşi Gül Hanım', cins: 'K', gorunum: 'yasli', kiyafet: '#B26A8A' }, mentor: DKT,
      adimlar: [
        { tip: 'konus', kim: 'refakat', metin: 'Üç hafta önce inme geçirdi. Ne demek istediğini anlıyorum ama sözcükler çıkmıyor.' },
        { tip: 'konus', kim: 'hasta', metin: 'Ben… ev… su… yok… of.' },
        { tip: 'sor', baslik: 'Görüşme', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('inme', 'İnme hangi taraftaydı, doktorlar ne dedi?', 'Sol tarafta, beynin sol tarafında demişler. Sağ kolu ve bacağı güçsüz.', 3, 'İnme|Sol orta serebral arter; sağda güçsüzlük.', 'refakat'),
          S('anlama', 'Söylediklerinizi anlıyor mu?', 'Basit şeyleri hemen anlıyor. Uzun anlatınca karışıyor.', 3, 'Anlama|Basit ve orta güçlükte yönergeleri anlıyor.', 'refakat'),
          S('yutma', 'Yemek yerken öksürme, boğulma oluyor mu?', 'Hayır, rahat yiyor.', 2, 'Yutma|Yakınma yok.', 'refakat'),
          S('el', 'İnmeden önce hangi elini kullanıyordu, mesleği neydi?', 'Sağ elini. Emekli öğretmen, çok okurdu.', 2, 'Önceki|Sağ elli, emekli öğretmen.', 'refakat'),
          S('tv', 'En sevdiği dizi hangisi?', 'Akşam haberlerini izler.', 0, null, 'refakat'),
          YARGI('hasta', 'Biraz daha uğraşsanız konuşursunuz, değil mi?', 'Ben… çok… istiyorum…', 'Afazi istek eksikliği değildir; bu söz kişiyi yıpratır.')
        ] },
        { tip: 'eylem', baslik: 'Kısa tarama', yonerge: 'yatak başında dene', secenek: [
          E('yonerge', '“Gözlerinizi kapatın, sonra elinizi kaldırın” de', 'İki basamaklı yönergeyi yerine getirdi.', 3),
          E('tekrar', '“Bugün hava çok güzel” cümlesini tekrar ettir', '“Hava… güzel… bu…” diyebildi; tekrar bozuk.', 3),
          E('adlandir', 'Saati gösterip adını sor; takılırsa ilk sesi ver', '“S…” ipucuyla “saat” dedi.', 2, { geri: 'İpucuyla gelişme, sözcük bulma terapisi için önemli bir bulgudur.' }),
          E('bagir', 'Anlasın diye daha yüksek sesle konuş', 'Hasan Bey rahatsız oldu; işitmesi yerinde.', -1, { geri: 'Afazide sorun işitme değil dildir; yüksek ses değil kısa ve net cümle gerekir.' })
        ] },
        K('İletişim', 'Hasan Bey ve eşiyle iletişimde ne önerirsin?', [
          ['Kısa ve net cümleler, yanıt için zaman tanıma; evet/hayır soruları, yazı, resim ve jestle destek', true, 'Doğru. Bu stratejiler anlamayı kolaylaştırır ve iletişimi sürdürür; eş eğitimi terapinin parçasıdır.'],
          ['Takıldığında sözcüğü hemen onun yerine söyleyin', false, 'Sürekli tamamlamak kendi üretim fırsatını elinden alır; önce zaman tanınır, gerekirse ipucu verilir.'],
          ['Konuşmayı zorlamayın, iyileşene kadar soru sormayın', false, 'İletişimden uzak tutmak yalnızlaşmayı artırır; destekli iletişim sürdürülmelidir.']
        ]),
        MASA('Vaka masasında değerlendirmeleri seç, bulguları oku; tanısal izlenimini ve terapi planını yaz.')
      ] },

    /* ------------------------------ Hipokinetik dizartri ------------------------------ */
    { id: 'dkt-pd', vaka: 'pd', lab: 'dkt', oda: 'dkt', odaAd: 'Nörolojik konuşma polikliniği', baslik: 'Parkinson, sesi çok kısılmış',
      hasta: { ad: 'Ayten Hanım', hitap: 'Ayten Hanım', yas: '70 yaş', cins: 'K', gorunum: 'yasli', kiyafet: '#2E8E7E' }, refakat: { ad: 'Kızı', cins: 'K', gorunum: 'yetiskin', kiyafet: '#C8573A' }, mentor: DKT,
      adimlar: [
        { tip: 'konus', kim: 'refakat', metin: 'Annemin sesi çok kısıldı. Telefonda hiç anlaşılmıyor, kalabalıkta konuşmaktan kaçıyor.' },
        { tip: 'konus', kim: 'hasta', metin: 'Bence ben normal konuşuyorum… onlar dinlemiyor.' },
        { tip: 'sor', baslik: 'Görüşme', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('tani', 'Parkinson tanısı ne zaman kondu, ilaçlarını düzenli alıyor mu?', 'Beş yıl önce. İlaçlarını düzenli içiyor.', 3, 'Tanı|Parkinson, 5 yıl; ilaç düzenli.', 'refakat'),
          S('yutma', 'Yemek ya da su içerken öksürüyor mu?', 'Arada yemekte öksürüyor.', 3, 'Yutma|Yemekte ara ara öksürük.', 'refakat'),
          S('kacinma', 'Bu durum günlük yaşamını nasıl etkiliyor?', 'Telefona çıkmıyor, misafir gelince sessiz kalıyor.', 2, 'Etki|Kaçınma, sosyal geri çekilme.', 'refakat'),
          S('algi', 'Ayten Hanım, sizce sesiniz nasıl?', 'Bana normal geliyor, bağırıyorum sanki.', 3, 'Algı|Kendi sesini olduğundan yüksek algılıyor.', 'hasta'),
          S('torun', 'Kaç torunu var?', 'Dört torunu var.', 0, null, 'refakat'),
          YARGI('hasta', 'Biraz daha uğraşsanız sesiniz çıkar aslında?', 'Uğraşıyorum ama…')
        ] },
        { tip: 'eylem', baslik: 'Kısa tarama', yonerge: 'ölç ve dinle', secenek: [
          E('db', 'Konuşmasında ses şiddetini ölç', 'Ses şiddeti düşük; cümle sonlarında daha da azalıyor.', 3),
          E('mpt', 'Uzun “aaa” dedirt (maksimum fonasyon süresi)', 'Süre kısa.', 3),
          E('okuma', 'Kısa bir paragraf okut, anlaşılırlığa bak', 'Monoton, hızlı kısa atakları olan, belirsiz ünsüzlü bir konuşma.', 2),
          E('fisilti', 'Sesini korumak için fısıldayarak konuşmasını öner', 'Mentor başını iki yana sallıyor.', -2, { geri: 'Hedef sesi azaltmak değil artırmaktır; fısıltı anlaşılırlığı daha da düşürür.' })
        ] },
        K('Güvenlik', 'Yemekte öksürme yakınmasını ne yaparsın?', [
          ['Yutma ayrıca değerlendirilir; gerekirse aletli inceleme ve güvenli yutma stratejileri planlanır', true, 'Doğru. Parkinson’da yutma güçlüğü sık ve sessiz seyredebilir; konuşma terapisiyle birlikte yutma da izlenmelidir.'],
          ['Ses terapisi bitince bakarız', false, 'Aspirasyon riski beklemeye bırakılmaz.'],
          ['Yemekleri daha hızlı yemesini söyle', false, 'Hızlı yemek aspirasyon riskini artırır.']
        ]),
        MASA('Vaka masasında değerlendirmeleri seç, bulguları oku; tanısal izlenimini ve terapi planını yaz.')
      ] },

    /* ------------------------------ Vokal nodül ------------------------------ */
    { id: 'dkt-nodul', vaka: 'nodul', lab: 'dkt', oda: 'dkt', odaAd: 'Ses polikliniği', baslik: 'Öğretmen, 6 aydır ses kısıklığı',
      hasta: { ad: 'Selin Hanım', hitap: 'Selin Hanım', yas: '34 yaş', cins: 'K', gorunum: 'yetiskin', kiyafet: '#E0A526' }, mentor: DKT,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Altı aydır sesim kısık. Akşamları ve hafta sonuna doğru iyice kötüleşiyor, çabuk yoruluyorum.' },
        { tip: 'sor', baslik: 'Görüşme', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('is', 'Gün içinde sesinizi nasıl kullanıyorsunuz?', 'İlkokul öğretmeniyim. Kalabalık sınıflarda bütün gün yüksek sesle konuşuyorum.', 3, 'Ses kullanımı|Öğretmen, gün boyu yüksek ses.'),
          S('kbb', 'KBB muayenesi oldunuz mu, ne dediler?', 'Evet, iki ses telinde nodül var dediler.', 3, 'KBB|İki taraflı vokal nodül.'),
          S('su', 'Gün içinde ne kadar su içiyorsunuz?', 'Pek içemiyorum, ders arası vakit olmuyor.', 2, 'Hidrasyon|Az su.'),
          S('zaman', 'Gün içinde nasıl değişiyor?', 'Sabah daha iyi, akşam kötü. Tatilde düzeliyor.', 2, 'Seyir|Akşam ve hafta sonu kötüleşiyor.'),
          S('sigara', 'Sigara kullanıyor musunuz?', 'Hayır.', 1, 'Sigara|Yok.'),
          YARGI('hasta', 'Hiç susmadığınız için mi oldu?', 'Mesleğim bu…', 'Mesleği küçümsemek yerine sesi nasıl kullandığını değiştirmeye odaklan.')
        ] },
        { tip: 'eylem', baslik: 'Ölçüm', yonerge: 'gerekenleri yap', secenek: [
          E('dinle', 'Sesini dinleyip GRBAS ile derecelendir', 'G1 R1 B1 A0 S1.', 3),
          E('mpt', 'Maksimum fonasyon süresini ölç', 'MPT 11 saniye.', 2),
          E('sz', 's ve z seslerini ayrı ayrı uzattır, oranını hesapla', 's/z oranı yaklaşık 1,5: “z” kısalıyor.', 3, { geri: 's/z oranının 1,4’ü aşması ses tellerinin kapanma sorununu düşündürür.' }),
          E('zorla', '“Sesinizin en yüksek hâlini duyalım” diye bağırt', 'Selin Hanım öksürmeye başladı.', -2, { geri: 'Zorlayıcı ses kullanımı nodüllü sesi daha da yorar.' })
        ] },
        K('Hemen öneri', 'Sınıfta sesini korumak için hemen ne önerirsin?', [
          ['Ses yükseltici/mikrofon, sık su, ders aralarında ses molaları; bağırmak yerine dikkat çekmek için sinyal (zil, el işareti)', true, 'Doğru. Ses hijyeni terapinin temelidir ve hemen uygulanabilir.'],
          ['Fısıldayarak ders anlatsın', false, 'Zorlu fısıltı ses tellerini dinlendirmez, aksine zorlayabilir.'],
          ['Boğazını sık sık temizlesin', false, 'Boğaz temizleme ses tellerine travma yapar; yerine yudum su önerilir.']
        ]),
        MASA('Vaka masasında değerlendirmeleri seç, bulguları oku; tanısal izlenimini ve terapi planını yaz.')
      ] },

    /* ------------------------------ Disfaji ------------------------------ */
    { id: 'dkt-disfaji', vaka: 'disfaji', lab: 'dkt', oda: 'acil', odaAd: 'Nöroloji servisi', baslik: 'İnme sonrası su içerken öksürük',
      hasta: { ad: 'Necmi Bey', hitap: 'Necmi Bey', yas: '78 yaş', cins: 'E', gorunum: 'yasli', sac: '#C9C4BA' }, refakat: { ad: 'Hemşire Aylin', cins: 'K', gorunum: 'yetiskin', kiyafet: '#5E9BD8' }, mentor: DKT, vital: { nabiz: 92, ta: '138/82', spo2: 95 },
      adimlar: [
        { tip: 'konus', kim: 'refakat', metin: 'Su içerken öksürüyor. Yemekten sonra sesi gurultulu oluyor. İki gündür de hafif ateşi var.' },
        { tip: 'sor', baslik: 'Görüşme', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('inme', 'İnme ne zaman oldu, hangi taraf?', 'On gün önce, sağ hemisfer inmesi.', 3, 'İnme|Sağ hemisfer, 10 gün.', 'refakat'),
          S('ates', 'Ateşi ne zamandır var, akciğer bulgusu var mı?', 'İki gündür 37,8 civarı. Doktor akciğer filmi istedi.', 3, 'Ateş|2 gün, düşük derece; aspirasyon şüphesi.', 'refakat'),
          S('nasil', 'Nasıl besleniyor, ne veriliyor?', 'Ağızdan; su, çorba ve yumuşak yemek veriyoruz.', 3, 'Beslenme|Ağızdan, ince sıvı dahil.', 'refakat'),
          S('ilac', 'Hangi ilaçları kullanıyor?', 'Tansiyon ve kan sulandırıcı.', 1, 'İlaç|Antihipertansif, antikoagülan.', 'refakat'),
          S('memleket', 'Nerelidir?', 'Sivaslı.', 0, null, 'refakat'),
          YARGI('refakat', 'Siz yanlış mı besliyorsunuz?', 'Biz söylendiği gibi veriyoruz…', 'Ekip arkadaşını suçlamak yerine birlikte güvenli plan kurulur.')
        ] },
        { tip: 'eylem', baslik: 'Yatak başı', yonerge: 'güvenli olanları yap', secenek: [
          E('oral', 'Ağız içi, dil hareketleri ve öksürüğünü değerlendir', 'Dil hareketleri yavaş, istemli öksürük zayıf.', 3),
          E('pozisyon', 'Yatak başını dik konuma getir', 'Necmi Bey dik oturuyor.', 2),
          E('agiz', 'Ağız hijyenine bak', 'Ağız içinde birikmiş artıklar var; ağız bakımı gerekiyor.', 2, { geri: 'Kötü ağız hijyeni aspirasyon pnömonisi riskini artırır.' }),
          E('bardak', 'Bir bardak suyu hızlıca içirerek dene', 'Monitör alarm veriyor: öksürük nöbeti, SpO₂ düşüyor.', -3, { anim: 'monitor', vital: { spo2: 90, nabiz: 108 }, alarm: { spo2: true }, geri: 'Aspirasyon şüphesi olan hastada büyük yudum ince sıvı tehlikelidir.' })
        ] },
        K('Güvenlik', 'Hemşire soruyor: “Su ve çorba vermeye devam edelim mi?”', [
          ['Aletli değerlendirme yapılana kadar ince sıvı verilmez; hekim ve ekiple güvenli beslenme ve sıvı planı yapılır, ağız bakımı sürdürülür', true, 'Doğru. Öksürüksüz aspirasyon yatak başında gözden kaçabilir; aletli değerlendirme (VFSS ya da FEES) bulgusuna göre kıvam belirlenir.'],
          ['Evet, öksürüyorsa refleksi çalışıyordur, sorun yok', false, 'Öksürük her aspirasyonu yakalamaz; ateş sessiz aspirasyonu düşündürür.'],
          ['Pipetle içirirseniz daha güvenli olur', false, 'Pipet sıvının hızını ve miktarını kontrol etmeyi zorlaştırabilir; değerlendirmeden önerilmez.']
        ]),
        MASA('Vaka masasında değerlendirmeleri seç, aletli bulguları oku; tanısal izlenimini ve terapi planını yaz.')
      ] },

    /* ============ 31.10.2026: Acadex Medica yeni hastaları (Osman Bey: inme zinciri, Kerem: Odyoloji'den sevk) ============ */
    /* ------------------------------ İnme sonrası yoğun bakımda yutma taraması ------------------------------ */
    { id: 'dkt-osman', vaka: 'osman', lab: 'dkt', oda: 'acil', odaAd: 'Nöroloji yoğun bakım', baslik: 'İnmenin ertesi günü: “ağızdan verelim mi?”',
      hasta: { ad: 'Osman Bey', hitap: 'Osman Bey', yas: '72 yaş', cins: 'E', gorunum: 'yasli', sac: '#C9C4BA', konusamaz: true, ifade: 'endise' }, refakat: { ad: 'Kızı Elif Hanım', cins: 'K', gorunum: 'yetiskin', kiyafet: '#7A4FA8', ifade: 'uzgun' }, mentor: DKT, vital: { nabiz: 88, ta: '154/88', spo2: 96 },
      adimlar: [
        { tip: 'konus', kim: 'refakat', metin: 'Babam dünden beri hiçbir şey yemedi, içmedi. Ağzı kurudu. Biraz su versem olmaz mı?' },
        { tip: 'konus', kim: 'mentor', metin: 'Acil servis yutma taramasını bize bıraktı. Önce güvenle başlayabilir miyiz, onu anlamamız gerek.' },
        { tip: 'sor', baslik: 'Görüşme', hak: 3, yonerge: 'taramaya başlamadan gereken bilgileri topla', secenek: [
          S('bilinc', 'Bugün ne kadar uyanık, sorulara gözünü açıp yanıt veriyor mu?', 'Sabahtan beri gözleri açık; başını sallayarak yanıt veriyor.', 3, 'Bilinç|Uyanık, basit komutlara uyuyor.', 'refakat'),
          S('tukuruk', 'Tükürüğünü yutabiliyor mu, ağzından akıyor mu?', 'Sağ ağız köşesinden tükürük akıyor, mendille siliyoruz.', 3, 'Salya|Sağ ağız köşesinden salya.', 'refakat'),
          S('ates', 'Ateşi ya da öksürüğü oldu mu?', 'Ateşi yok, öksürmedi.', 2, 'Solunum|Ateş ve öksürük yok.', 'refakat'),
          S('dis', 'Takma dişi var mı?', 'Üst protezi var, çıkarıldı.', 1, null, 'refakat'),
          S('memleket', 'Nerelisiniz?', 'Kastamonulu.', 0, null, 'refakat'),
          YARGI('refakat', 'Siz ona bir şey verdiniz mi gizlice?', 'Hayır, vermedik…', 'Aileyi suçlamak yerine neden beklediğimizi açıklamak iş birliğini artırır.')
        ] },
        { tip: 'eylem', baslik: 'Yatak başı tarama', yonerge: 'güvenli sırayla yap', secenek: [
          E('postur', 'Yatak başını dik konuma getir', 'Osman Bey dik oturuyor; başı ortada.', 2),
          E('oral', 'Dudak, dil, yumuşak damak ve istemli öksürüğü değerlendir', 'Sağ dudak ve dil hareketi zayıf; istemli öksürük zayıf.', 3),
          E('kasik', 'Çay kaşığıyla üç kez az su dene, sesini dinle', 'İlk kaşıkta yutma gecikiyor; ikinci kaşıktan sonra ıslak ses ve öksürük.', 3, { ifade: 'endise' }),
          E('bardak', 'Bir bardak suyu yudum yudum içir', 'Monitör alarm veriyor: öksürük nöbeti, SpO₂ düşüyor.', -3, { anim: 'monitor', vital: { spo2: 90, nabiz: 108 }, alarm: { spo2: true }, ifade: 'agri', geri: 'Tarama küçük miktarla başlar; bardaktan içirmek aspirasyon riskidir.' })
        ] },
        K('Güvenlik', 'Kızı soruyor: “Su ve çorba versek olmaz mı?”', [
          ['Şimdilik ağızdan verilmez; ekiple geçici tüple beslenme önerilir, ağız bakımı yapılır ve her gün yeniden değerlendirilir', true, 'Doğru. Islak ses ve öksürük taramanın başarısız olduğunu gösterir. Beslenme kesintiye uğramamalı: diyetisyen enteral planı yapar.'],
          ['Yoğurt gibi koyu şeyler verilebilir', false, 'Aletli değerlendirme yapılmadan kıvam seçilmez.'],
          ['Pipetle küçük yudumlar olur', false, 'Pipet sıvı hızını kontrolü zorlaştırabilir; değerlendirmeden önerilmez.']
        ]),
        MASA('Vaka masasında değerlendirmeleri seç, bulguları oku; tanısal izlenimini ve planını yaz. Sonra Diyet katına konsültasyon iste.')
      ] },

    /* ------------------------------ İşitme kaybına bağlı dil gecikmesi ------------------------------ */
    { id: 'dkt-kerem', vaka: 'kerem', lab: 'dkt', oda: 'dkt', odaAd: 'Çocuk dil ve konuşma odası', baslik: 'Yeni işitme cihazlı, 15 sözcüklü çocuk',
      hasta: { ad: 'Kerem', hitap: 'Kerem', yas: '4 yaş', cins: 'E', gorunum: 'cocuk', sac: '#2E241C', kiyafet: '#E0A526' }, refakat: { ad: 'Annesi Seda Hanım', cins: 'K', gorunum: 'yetiskin', kiyafet: '#6A4FA8' }, mentor: DKT,
      adimlar: [
        { tip: 'konus', kim: 'refakat', metin: 'Odyoloji’de işitme kaybı dediler, cihazlar geçen hafta takıldı. Şimdi konuşmaya başlar mı?' },
        { tip: 'sor', baslik: 'Görüşme', hak: 3, yonerge: 'dil gelişimini ve cihaz kullanımını aydınlatan soruları seç', secenek: [
          S('cihaz', 'Cihazları günde kaç saat takıyor?', 'Dört saat kadar; sonra çıkarıp atıyor.', 3, 'Cihaz|Günde ≈4 saat.', 'refakat'),
          S('anlama', 'Söylediklerinizi anlıyor mu, basit yönergeleri yapıyor mu?', '“Ayakkabını getir” deyince getiriyor, iki adımlıları karıştırıyor.', 3, 'Anlama|Tek adımlı yönergeler.', 'refakat'),
          S('iletisim', 'İsteklerini nasıl anlatıyor?', 'İşaret ediyor, elimden çekiyor; bazen sinirleniyor.', 2, 'İfade|Jest ve işaret ağırlıklı.', 'refakat'),
          S('oyun', 'Başka çocuklarla nasıl oynuyor?', 'Kuzenleriyle oynuyor, sırasını bekliyor.', 2, 'Sosyal|Oyun ve sosyal etkileşim yaşına uygun.', 'refakat'),
          S('tv', 'Ekran süresi ne kadar?', 'Akşamları bir saat.', 1, null, 'refakat'),
          YARGI('refakat', 'Siz evde onunla yeterince konuşmuyor musunuz?', 'Konuşuyoruz ama duymuyordu ki…', 'Aileyi suçlamak değil, terapinin merkezine koymak gerekir.')
        ] },
        { tip: 'eylem', baslik: 'Gözlem', yonerge: 'gerekenleri yap', secenek: [
          E('oyun', 'Oyuncakla serbest oyun içinde iletişimini gözle', 'Göz teması iyi; ortak dikkat kuruyor; “araba”, “ver”, “anne” diyor.', 3),
          E('ses', 'Arkasından adını normal sesle söyle (cihaz takılıyken)', 'Cihazla adına dönüyor.', 2, { ifade: 'rahat' }),
          E('cihaz', 'Cihazların çalıştığını ve pilini kontrol et', 'Sol cihazın pili zayıf; değiştirildi.', 2),
          E('tekrar', 'Sözcükleri doğru söyleyene kadar tekrar ettir', 'Kerem sıkılıyor, ağlıyor ve oyunu bırakıyor.', -2, { ifade: 'uzgun', geri: 'Zorla tekrar ettirmek iletişim isteğini azaltır; model ol ve genişlet.' })
        ] },
        K('Aile', 'Annesi soruyor: “Cihaza alışsın, terapiye bir yıl sonra mı başlayalım?”', [
          ['Hayır; cihaz uyanık olunan her saatte takılmalı ve aileyi merkeze alan dil terapisi hemen başlamalı, odyolojiyle birlikte izlenmeli', true, 'Doğru. Dil gelişiminin kritik dönemindeyiz; işitsel girdi ne kadar erken ve uzun olursa dil o kadar hızlı ilerler.'],
          ['Evet, önce bir yıl cihaza alışsın', false, 'Bekleme kritik dönemi kaçırır.'],
          ['Cihaz yetmez, hemen işaret dili dışında her şey bırakılsın', false, 'Karar aileyle, işitsel ilerlemeye ve ailenin tercihine göre verilir; tek yol dayatılmaz.']
        ]),
        MASA('Vaka masasında değerlendirmeleri seç, bulguları oku; tanısal izlenimini ve terapi planını yaz.')
      ] },

    /* ------------------------------ Yarık damak ------------------------------ */
    { id: 'dkt-yarik', vaka: 'yarik', lab: 'dkt', oda: 'dkt', odaAd: 'Çocuk dil ve konuşma odası', baslik: '“Konuşması burnundan geliyor”',
      hasta: { ad: 'Mira', hitap: 'Mira', yas: '6 yaş', cins: 'K', gorunum: 'cocuk', sac: '#5A3A22', kiyafet: '#D9472B', ifade: 'uzgun' }, refakat: { ad: 'Babası', cins: 'E', gorunum: 'yetiskin', kiyafet: '#4E7AA8' }, mentor: DKT,
      adimlar: [
        { tip: 'konus', kim: 'refakat', metin: 'Mira’nın konuşması burnundan geliyor gibi. Sınıfta çocuklar taklit ediyor, artık parmak kaldırmak istemiyor.' },
        { tip: 'sor', baslik: 'Görüşme', hak: 3, yonerge: 'yapısal nedeni aydınlatan soruları seç', secenek: [
          S('ameliyat', 'Doğumda bir sorun oldu mu, ameliyat geçirdi mi?', 'Damağı yarıktı; bir yaşında kapattılar.', 3, 'Öykü|Yarık damak, 1 yaşında onarım.', 'refakat'),
          S('burun', 'Su içerken burnundan geldiği oluyor mu?', 'Evet, özellikle hızlı içince.', 3, 'Nazal geri kaçış|Sıvıda burundan geliş.', 'refakat'),
          S('kulak', 'Sık kulak iltihabı geçirdi mi, işitmesi ölçüldü mü?', 'Çok geçirdi; iki yıldır ölçtürmedik.', 2, 'Kulak|Sık otit; güncel işitme ölçümü yok.', 'refakat'),
          S('okul', 'Okulda konuşmak konusunda nasıl hissediyor?', 'Utanıyor, sınıfta susuyor.', 2, 'Psikososyal|Utanma, konuşmadan kaçınma.', 'refakat'),
          S('renk', 'En sevdiği renk ne?', 'Mor.', 0, null, 'refakat'),
          YARGI('refakat', 'Ameliyat geç mi yapıldı, siz mi ertelediniz?', 'Doktorların dediği zaman yapıldı…', 'Geçmiş kararları sorgulamak yerine bugünkü değerlendirmeye odaklan.')
        ] },
        { tip: 'eylem', baslik: 'Gözlem', yonerge: 'gerekenleri yap', secenek: [
          E('ayna', 'Burnun altına ayna tutup “papa, baba” dedir', 'Ayna her hecede buğulanıyor: nazal emisyon.', 3),
          E('dinle', 'Ünlüleri burun açık-kapalı söylet ve dinle', 'Burun kapatılınca ses belirgin değişiyor: hipernazalite.', 3),
          E('ses', 'Basınçlı sesleri içeren cümle söylet', '“p” yerine gırtlaktan bir durak sesi çıkarıyor.', 2),
          E('ufle', 'Balon şişirtip “bunu her gün yap” de', 'Mira balonu şişiremiyor, üzülüyor.', -2, { ifade: 'uzgun', geri: 'Üfleme egzersizlerinin konuşmadaki nazaliteyi düzelttiği gösterilmemiştir.' })
        ] },
        K('Aile', 'Babası soruyor: “Terapi yaparsak burundan konuşma tamamen geçer mi?”', [
          ['Burundan kaçan hava yapısal bir sorunu düşündürüyor; damak ekibine görüntüleme için yönlendireceğiz. Yanlış öğrenilmiş sesleri ise terapide düzeltebiliriz', true, 'Doğru. Yapı terapiyle değişmez; hangi sorunun yapısal, hangisinin öğrenilmiş olduğunu ayırmak aileye gerçekçi bir beklenti verir.'],
          ['Evet, düzenli üfleme egzersizleriyle geçer', false, 'Kanıt yok; yapısal yetmezlik terapiyle kapanmaz.'],
          ['Büyüyünce kendiliğinden düzelir', false, 'Bekleme psikososyal etkileri ve telafi edici alışkanlıkları artırır.']
        ]),
        MASA('Vaka masasında değerlendirmeleri seç, bulguları oku; tanısal izlenimini ve terapi planını yaz.')
      ] },

    /* ------------------------------ Erişkin kekemelik ------------------------------ */
    { id: 'dkt-ykek', vaka: 'ykek', lab: 'dkt', oda: 'dkt', odaAd: 'Erişkin akıcılık polikliniği', baslik: 'İş görüşmesinden önce kilitlenen genç',
      hasta: { ad: 'Mert', hitap: 'Mert Bey', yas: '24 yaş', cins: 'E', gorunum: 'genc', kiyafet: '#2E3A5C', ifade: 'endise' }, mentor: DKT,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Gelecek ay çok istediğim bir iş görüşmesi var. Adımı söylerken bile takılıyorum; telefon çalınca açmıyorum.' },
        { tip: 'sor', baslik: 'Görüşme', hak: 3, yonerge: 'akıcılığı ve yaşam etkisini aydınlatan soruları seç', secenek: [
          S('kacin', 'Takılmamak için kaçındığınız durumlar ya da sözcükler var mı?', 'Telefonu açmıyorum, restoranda söylenmesi kolay yemeği sipariş ediyorum.', 3, 'Kaçınma|Telefon, sipariş; sözcük değiştirme.'),
          S('baslangic', 'Takılmalar ne zaman başladı, daha önce terapi aldınız mı?', '4 yaşında başlamış; ilkokulda biraz terapi aldım.', 3, 'Öykü|4 yaşından beri; çocuklukta kısa terapi.'),
          S('his', 'Takıldığınız anda neler hissediyorsunuz?', 'Boğazım kilitleniyor, yüzüm kızarıyor, gözlerimi kırpıyorum.', 2, 'Eşlik eden|Blok, göz kırpma, utanç.'),
          S('ilac', 'Düzenli ilaç kullanıyor musunuz?', 'Hayır.', 1),
          S('dizi', 'Hangi dizileri izliyorsunuz?', 'Bilim kurgu.', 0),
          YARGI('hasta', 'Biraz sakin olsanız takılmazsınız aslında.', 'Keşke o kadar kolay olsa…', 'Kekemelik bir kaygı sorunu değildir; “sakin ol” önerisi suçlayıcıdır.')
        ] },
        { tip: 'eylem', baslik: 'Gözlem', yonerge: 'gerekenleri yap', secenek: [
          E('okuma', 'Bir paragraf okutup takılmaları say', 'Okumada %TH ≈ 6; 2–3 saniyelik bloklar.', 3),
          E('telefon', 'Rol yapma: telefonla randevu alma', 'Telefonda %TH ≈ 12; göz kırpma ve baş hareketi artıyor.', 3, { ifade: 'endise' }),
          E('olcek', 'Kaçınma ve yaşam kalitesi ölçeğini doldurt', 'Kaçınma ve konuşma kaygısı yüksek düzeyde.', 2),
          E('tamamla', 'Takıldığı sözcükleri onun yerine tamamla', 'Mert susuyor, gözlerini kaçırıyor.', -2, { ifade: 'uzgun', geri: 'Sözcüğü tamamlamak iyi niyetli olsa da kişinin söz hakkını elinden alır.' })
        ] },
        K('Hedef', 'Mert soruyor: “Görüşmeye kadar kekemeliğimi tamamen bitirebilir miyiz?”', [
          ['Amaç kekemeliği sıfırlamak değil; akıcılığı artıran teknikler ve kaçınmayı azaltan gerçek ortam provalarıyla görüşmede rahat konuşmak', true, 'Doğru. Gerçekçi hedef güven verir; teknik çalışma ile kaygıya yönelik yaklaşım birlikte en iyi sonucu verir.'],
          ['Evet, bir ayda tamamen geçer', false, 'Erişkinde gerçekçi olmayan vaat başarısızlık hissini artırır.'],
          ['Takılınca susup sözcüğü değiştirmeyi öğrenmek yeterli', false, 'Sözcük değiştirmek kaçınmayı besler.']
        ]),
        MASA('Vaka masasında değerlendirmeleri seç, bulguları oku; tanısal izlenimini ve terapi planını yaz.')
      ] }
  ];
});
