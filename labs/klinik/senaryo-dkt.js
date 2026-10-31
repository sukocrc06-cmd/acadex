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
      ] }
  ];
});
