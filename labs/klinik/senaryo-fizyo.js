/* ==========================================================================
   ACADEX KLİNİK · Fizyoterapi senaryoları (labs/klinik/senaryo-fizyo.js), 31.10.2026
   Acadex Medica'nın fizyoterapi katı için 6 vaka. Fizyo Lab'de hasta vakası yoktu; bu
   vakalar lab'ın araçlarına devredilir:
     hedef 'test:<id>' → Fizyo Lab özel testler (FZ_TESTS): 3B modelde testin uygulanışı
     hedef 'prot:<id>' → Fizyo Lab protokoller (FZ_PROT): faz hedefleri ve egzersizler
   Test ve protokol kimlikleri labs/fizyo/index.html ile AYNI olmalıdır (tests/medica.js denetler).
   Klinik bilgiler genel kabul görmüş ders kitabı bilgisidir (Ottawa ayak bileği kuralları,
   kauda ekina kırmızı bayrakları, ÖÇB rehabilitasyon ilkeleri). EĞİTİM AMAÇLIDIR; kurgusaldır.
   ========================================================================== */
(function (root, factory) {
  var L = factory();
  if (typeof module === 'object' && module.exports) module.exports = L;
  else if (root.AXKLINIK) root.AXKLINIK.ekle(L);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var FZT = { ad: 'Mert', unvan: 'Fzt.', cins: 'E' };
  var S = function (id, t, cevap, puan, not, kim, geri) { return { id: id, t: t, cevap: cevap, puan: puan, not: not || null, kim: kim || null, geri: geri || null }; };
  var E = function (id, t, sonuc, puan, o) { return Object.assign({ id: id, t: t, sonuc: sonuc, puan: puan }, o || {}); };
  var K = function (baslik, soru, secenek) { return { tip: 'karar', baslik: baslik, soru: soru, secenek: secenek.map(function (x) { return { t: x[0], dogru: !!x[1], geri: x[2] }; }) }; };
  var TEST = function (id, metin) { return { tip: 'devir', metin: metin, dugme: 'Testi 3B modelde uygula', hedef: 'test:' + id }; };
  var PROT = function (id, metin) { return { tip: 'devir', metin: metin, dugme: 'Protokolü aç', hedef: 'prot:' + id }; };
  var YARGI = function (kim, t, cevap, geri) { return S('yargi', t, cevap, -2, null, kim, geri || 'Suçlayıcı ya da küçümseyen soru güveni sarsar ve bilgi akışını keser.'); };

  return [
    /* ------------------------------ Subakromiyal sıkışma ------------------------------ */
    { id: 'fz-omuz', vaka: 'neer', lab: 'fizyo', oda: 'fizyo', odaAd: 'Fizik tedavi polikliniği', baslik: 'Kolunu kaldırınca omuz ağrısı',
      hasta: { ad: 'Nilgün Hanım', hitap: 'Nilgün Hanım', yas: 52, cins: 'K', gorunum: 'yetiskin', kiyafet: '#7A4FA8' }, mentor: FZT,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Sağ omzum üç aydır ağrıyor. Kolumu kaldırınca, özellikle yarısına gelince sızlıyor. Resim yaparken zorlanıyorum.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'ağrının kaynağını daraltan soruları seç', secenek: [
          S('travma', 'Düşme, darbe ya da ani bir zorlama oldu mu?', 'Hayır, yavaş yavaş başladı. Tavanı boyadıktan sonra artmıştı.', 3, 'Başlangıç|Travmasız, tekrarlayan baş üstü aktivite sonrası.'),
          S('gece', 'Gece o tarafa yatınca ağrıyor mu?', 'Evet, sağ tarafıma dönünce uyanıyorum.', 2, 'Gece|Etkilenen tarafa yatınca ağrı.'),
          S('boyun', 'Boynunuz ağrıyor mu, kolunuza uyuşma yayılıyor mu?', 'Boynum iyi, uyuşma yok.', 3, 'Boyun|Ağrı ve uyuşma yok: servikal kaynak olası değil.'),
          S('guc', 'Kolunuzu kaldıramadığınız oldu mu, güçsüzlük var mı?', 'Kaldırabiliyorum, sadece ağrıyor.', 2, 'Güç|Güçsüzlük yok.'),
          S('meslek', 'Kaç yıldır resim yapıyorsunuz?', 'Otuz yıl oldu.', 0),
          YARGI('hasta', 'Yaşınızda bu kadar boya yapmak doğru mu?', 'Ama işim bu…')
        ] },
        { tip: 'eylem', baslik: 'Muayene', yonerge: 'gerekenleri yap', secenek: [
          E('ark', 'Kolu yandan aktif olarak kaldırt, ağrıyı gözle', 'Yaklaşık 70° ile 120° arasında ağrı, sonra azalıyor: ağrılı ark.', 3, { anim: 'hasta' }),
          E('guc', 'Omuz kas gücünü test et', 'Dış rotasyon güçlü; abduksiyon ağrılı ama güçlü.', 2),
          E('boyun', 'Boyun hareketlerini kontrol et', 'Boyun hareketleri ağrısız ve tam.', 2),
          E('zorla', 'Ağrıya rağmen kolu zorlayarak tam açıklığa it', 'Nilgün Hanım geri çekiliyor, yüzü buruştu.', -2, { geri: 'Ağrıyı provoke ederek zorlamak güveni bozar; muayene ağrı sınırına saygı gösterir.' })
        ] },
        K('Özel test seçimi', 'Sıkışma şüphesini sınamak için hangi testleri seçersin?', [
          ['Neer ve Hawkins–Kennedy testleri, gerekirse boş kutu (Jobe); tek teste değil test kümesine bakılır', true, 'Doğru. Tek bir testin özgüllüğü düşüktür; birkaç testin birlikte değerlendirilmesi olasılığı daha iyi gösterir.'],
          ['Lachman testi', false, 'Lachman diz ön çapraz bağı içindir.'],
          ['Yalnızca röntgen yeterli, test gerekmez', false, 'Röntgen yumuşak dokuyu göstermez; klinik testler muayenenin parçasıdır.']
        ]),
        TEST('neer', 'Fizyo Lab’de Neer testinin uygulanışını 3B modelde izle, ilgili testlere (Hawkins, boş kutu) geç.')
      ] },

    /* ------------------------------ Akut ÖÇB yaralanması ------------------------------ */
    { id: 'fz-lachman', vaka: 'lachman', lab: 'fizyo', oda: 'fizyo', odaAd: 'Spor fizyoterapisi', baslik: 'Maçta dizinden “pat” sesi',
      hasta: { ad: 'Kerem', hitap: 'Kerem', yas: 22, cins: 'E', gorunum: 'genc', kiyafet: '#C8573A', ifade: 'agri' }, mentor: FZT,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Dün maçta dönerken dizimden bir “pat” sesi geldi. Hemen şişti, oyuna devam edemedim.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'yaralanma mekanizmasını anla', secenek: [
          S('mek', 'Tam olarak nasıl oldu, temas var mıydı?', 'Kimse çarpmadı. Topla dönerken ayağım yerde kaldı, dizim içeri kaçtı.', 3, 'Mekanizma|Temassız, ayak sabitken dönme (pivot).'),
          S('sislik', 'Şişlik ne kadar sürede çıktı?', 'Birkaç saat içinde top gibi oldu.', 3, 'Şişlik|Saatler içinde (hemartroz düşündürür).'),
          S('bosluk', 'Dizinizin boşaldığını, kaydığını hissediyor musunuz?', 'Basınca sanki yerinden kayacak gibi.', 2, 'İnstabilite|Boşalma hissi.'),
          S('kilit', 'Dizin bir pozisyonda kilitlendiği oldu mu?', 'Hayır, kilitlenmedi.', 1, 'Kilitlenme|Yok.'),
          S('pozisyon', 'Takımda hangi mevkide oynuyorsun?', 'Kanat.', 0),
          YARGI('hasta', 'Isınmadan mı çıktın sahaya?', 'Isındım hocam…')
        ] },
        { tip: 'eylem', baslik: 'Muayene', yonerge: 'gerekenleri yap', secenek: [
          E('efuzyon', 'Dizde efüzyona bak', 'Belirgin efüzyon var.', 3, { anim: 'hasta' }),
          E('rom', 'Diz hareket açıklığını ölç', 'Fleksiyon 90° ile sınırlı, ekstansiyonda −5° eksik.', 2),
          E('kemik', 'Kemik hassasiyeti ve yük verme kontrolü', 'Kemik hassasiyeti yok, aksayarak yük verebiliyor.', 2),
          E('ziplat', 'Tek ayak üstünde zıplat', 'Kerem diz boşalınca düşmek üzereydi.', -3, { geri: 'Akut instabil dizde zıplamak ek yaralanma (menisküs, kıkırdak) riskidir.' })
        ] },
        K('Özel test seçimi', 'Akut dönemde ön çapraz bağı değerlendirmek için en uygun test hangisi?', [
          ['Lachman testi: diz 20–30° fleksiyonda; akut dönemde ön çekmeceden daha duyarlı', true, 'Doğru. Akut şişlik ve hamstring koruma spazmı 90° ön çekmece testini yanıltabilir; Lachman daha güvenilirdir.'],
          ['Thomas testi', false, 'Thomas testi kalça fleksör kısalığı içindir.'],
          ['Hiç test yapmadan doğrudan MR', false, 'Klinik muayene karar için temel; MR gerektiğinde istenir.']
        ]),
        TEST('lachman', 'Fizyo Lab’de Lachman testini 3B modelde izle; ön çekmece ve pivot shift ile karşılaştır.')
      ] },

    /* ------------------------------ ÖÇB rekonstrüksiyonu sonrası ------------------------------ */
    { id: 'fz-ocb', vaka: 'ocb', lab: 'fizyo', oda: 'fizyo', odaAd: 'Ortopedik rehabilitasyon', baslik: 'ÖÇB ameliyatından 10 gün sonra',
      hasta: { ad: 'Ayşe Hanım', hitap: 'Ayşe Hanım', yas: 28, cins: 'K', gorunum: 'genc', kiyafet: '#2E8E7E' }, mentor: FZT,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'On gün önce ön çapraz bağ ameliyatı oldum. Bir an önce koşmaya dönmek istiyorum.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'rehabilitasyonu planlamak için sor', secenek: [
          S('greft', 'Hangi greft kullanıldı, ek bir girişim (menisküs onarımı) yapıldı mı?', 'Arka uyluktan tendon alındı (hamstring). Menisküse dokunulmamış.', 3, 'Cerrahi|Hamstring greft, izole ÖÇB.'),
          S('cerrah', 'Cerrahınız yük verme ve dizlik için ne dedi?', 'Değneklerle ağrım elverdiği kadar basabilirim dedi.', 3, 'Talimat|Tolere edildiği kadar yük, koltuk değneği.'),
          S('agri', 'Ağrınız ve şişliğiniz nasıl?', 'Ağrı 3/10, şişlik azalıyor.', 2, 'Ağrı|3/10, efüzyon azalıyor.'),
          S('yastik', 'Uyurken dizinizin altına yastık koyuyor musunuz?', 'Evet, öyle daha rahat ediyorum.', 3, 'Pozisyon|Diz altına yastık: ekstansiyon kaybı riski.'),
          S('spor', 'Hangi sporu yapıyorsunuz?', 'Hafta sonları koşuyorum.', 0),
          YARGI('hasta', 'Dikkatsizlikten mi sakatlandınız?', 'Kayak yaparken düştüm…')
        ] },
        { tip: 'eylem', baslik: 'Muayene', yonerge: 'gerekenleri yap', secenek: [
          E('ext', 'Diz ekstansiyonunu ölç', 'Pasif ekstansiyonda −5° eksik.', 3, { anim: 'hasta', geri: 'Erken dönemde tam ekstansiyonu kazanmak öncelikli hedeftir.' }),
          E('slr', 'Düz bacak kaldırma ve kuadriseps kasılmasına bak', 'Düz bacak kaldırırken dizde 10° ekstansiyon gecikmesi var.', 3),
          E('flex', 'Diz fleksiyonunu ölç', 'Fleksiyon 85°.', 2),
          E('hamstring', 'Dirençli hamstring kuvvet çalışmasına başlat', 'Mentor seni durduruyor.', -3, { geri: 'Hamstring greftinde ilk 6 hafta dirençli hamstring kuvvetlendirmesi yapılmaz.' })
        ] },
        K('Faz 1 önceliği', 'Ayşe Hanım’a ilk haftalar için ne söylersin?', [
          ['Önce tam pasif ekstansiyon ve kuadriseps aktivasyonu; diz altına yastık konmaz, geçiş takvime değil ölçütlere göre yapılır', true, 'Doğru. Ekstansiyon kaybı en sık ve en zor düzelen sorunlardan biridir; koşuya dönüş aylar sonra ve ölçütlerle verilir.'],
          ['Ağrı yoksa iki hafta sonra koşuya başlayabilirsin', false, 'Greftin iyileşmesi aylar sürer; koşuya dönüş ölçütlere göre genellikle 3. aydan sonra planlanır.'],
          ['Şişlik geçene kadar dizi hiç hareket ettirme', false, 'Erken kontrollü hareket ekstansiyon kaybını ve yapışıklığı önler.']
        ]),
        PROT('ocb', 'Fizyo Lab’de ÖÇB rekonstrüksiyonu protokolünü aç; Faz 1 hedeflerini ve egzersizlerini incele, programa aktar.')
      ] },

    /* ------------------------------ Karpal tünel ------------------------------ */
    { id: 'fz-karpal', vaka: 'phalen', lab: 'fizyo', oda: 'fizyo', odaAd: 'El rehabilitasyonu', baslik: 'Geceleri uyuşan parmaklar',
      hasta: { ad: 'Fatma Hanım', hitap: 'Fatma Hanım', yas: 45, cins: 'K', gorunum: 'yetiskin', kiyafet: '#C8573A' }, mentor: FZT,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Geceleri sağ elim uyuşuyor, uykudan uyanıyorum. Elimi sallayınca geçiyor.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'sinirin hangisi olduğunu daraltan soruları seç', secenek: [
          S('parmak', 'Tam olarak hangi parmaklarınız uyuşuyor?', 'Başparmak, işaret ve orta parmak. Serçe parmağım iyi.', 3, 'Dağılım|1–3. parmaklar (n. medianus alanı).'),
          S('is', 'Gün içinde elinizi nasıl kullanıyorsunuz?', 'Markette kasiyerim; gün boyu barkod okutuyorum.', 2, 'Kullanım|Tekrarlayan bilek hareketi.'),
          S('hastalik', 'Şeker, tiroit hastalığınız var mı, gebe misiniz?', 'Tiroit ilacı kullanıyorum, hipotiroidi var.', 3, 'Risk|Hipotiroidi.'),
          S('dusurme', 'Elinizden bir şey düşürüyor musunuz?', 'Son zamanlarda düğme iliklemekte zorlanıyorum.', 2, 'Motor|İnce becerilerde zorlanma.'),
          S('kahve', 'Kahve içiyor musunuz?', 'Günde iki fincan.', 0),
          YARGI('hasta', 'Telefonla çok mu oynuyorsunuz?', 'Pek kullanmam aslında…')
        ] },
        { tip: 'eylem', baslik: 'Muayene', yonerge: 'gerekenleri yap', secenek: [
          E('duyu', 'Parmak uçlarında duyuyu karşılaştır', 'İşaret ve orta parmak uçlarında his azalmış; serçe parmak normal.', 3),
          E('tenar', 'Başparmak kökündeki (tenar) kaslara bak', 'Tenar bölgede hafif düzleşme, başparmak abduksiyonu biraz zayıf.', 3, { geri: 'Tenar atrofi ileri basının işaretidir; daha ileri değerlendirme gerekebilir.' }),
          E('boyun', 'Boyun hareketlerini ve refleksleri kontrol et', 'Boyun ağrısız, refleksler normal.', 2),
          E('sik', 'Bileğini sıkı bandajla sar', 'Fatma Hanım’ın parmakları daha çok karıncalanıyor.', -2, { geri: 'Sıkı sargı basıyı artırır; gece nötral bilek splinti tercih edilir.' })
        ] },
        K('Özel test seçimi', 'Ön tanıyı desteklemek için hangi testleri yaparsın?', [
          ['Phalen testi ve el bileğinde Tinel işareti; duyu ve kas gücüyle birlikte yorumlanır, ileri olguda elektronörografi', true, 'Doğru. Testler duyu dağılımı ve tenar bulgularla birlikte değerlendirilir; kesin tanı ve şiddet için elektrofizyoloji kullanılır.'],
          ['Finkelstein testi', false, 'Finkelstein de Quervain tenosinoviti içindir.'],
          ['Thompson testi', false, 'Thompson aşil tendonu yırtığı içindir.']
        ]),
        TEST('phalen', 'Fizyo Lab’de Phalen testini 3B modelde izle; Tinel işaretiyle karşılaştır.')
      ] },

    /* ------------------------------ Lomber radikülopati ------------------------------ */
    { id: 'fz-bel', vaka: 'slr', lab: 'fizyo', oda: 'fizyo', odaAd: 'Omurga rehabilitasyonu', baslik: 'Bacağa vuran bel ağrısı',
      hasta: { ad: 'Serkan Bey', hitap: 'Serkan Bey', yas: 38, cins: 'E', gorunum: 'yetiskin', kiyafet: '#3E6E9E', ifade: 'agri' }, mentor: FZT,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Bir haftadır belim ağrıyor, ağrı sol bacağımın arkasından ayağıma kadar iniyor.' },
        { tip: 'konus', kim: 'mentor', metin: 'Bel ağrısında önce kırmızı bayrakları dışlarız. Sorularını buna göre seç.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'kırmızı bayrakları ve kök tutulumunu sorgula', secenek: [
          S('mesane', 'İdrar ya da dışkı kontrolünde değişiklik oldu mu?', 'Hayır, öyle bir şey yok.', 3, 'Kırmızı bayrak|Mesane-barsak işlevi normal.'),
          S('eyer', 'Kasık ve makat çevresinde uyuşma var mı?', 'Yok.', 3, 'Kırmızı bayrak|Eyer anestezisi yok.'),
          S('yayilim', 'Ağrı dizinizin altına iniyor mu, uyuşma var mı?', 'Baldırımın arkasından ayağımın dış kenarına kadar iniyor, orada uyuşukluk var.', 3, 'Yayılım|Diz altına inen, ayak dış kenarında uyuşma.'),
          S('ates', 'Ateş, kilo kaybı ya da kanser öyküsü var mı?', 'Hayır.', 2, 'Sistemik|Yok.'),
          S('arac', 'Hangi arabayı kullanıyorsunuz?', 'Kamyonet, kargo dağıtıyorum.', 0),
          YARGI('hasta', 'Ağır kaldırmayı neden bırakmıyorsunuz?', 'İşim bu, mecburum…')
        ] },
        { tip: 'eylem', baslik: 'Muayene', yonerge: 'gerekenleri yap', secenek: [
          E('noro', 'Alt ekstremite güç, duyu ve reflekslerine bak', 'Sol ayak bileği plantar fleksiyonu hafif zayıf, Aşil refleksi solda azalmış; ayak dış kenarında his azalmış.', 3),
          E('yurume', 'Parmak ucunda ve topukta yürüt', 'Sol parmak ucunda yürümekte zorlanıyor.', 2),
          E('postur', 'Ayakta duruşunu ve bel hareketlerini gözle', 'Hafif sağa eğik duruyor; öne eğilmek ağrıyı artırıyor.', 2),
          E('manip', 'Muayeneyi bitirmeden güçlü bel manipülasyonu yap', 'Mentor seni durduruyor.', -3, { geri: 'Nörolojik defisit varken değerlendirme tamamlanmadan manipülasyon yapılmaz.' })
        ] },
        K('Kırmızı bayraklar', 'Kırmızı bayrak yok, nörolojik bulgu var. Sıradaki adımın ne?', [
          ['Nöral gerginlik testleri (düz bacak kaldırma, slump) ile değerlendirmeyi tamamla; nörolojik bulguyu kaydet ve izle', true, 'Doğru. Kauda ekina bulguları yoksa konservatif değerlendirme sürer; ilerleyen güçsüzlük ya da kırmızı bayrak gelişirse acil yönlendirme yapılır.'],
          ['Hemen acil cerrahiye gönder', false, 'Mesane-barsak sorunu ya da eyer anestezisi olmadan acil cerrahi gerekmez; ilerleyici defisitte yönlendirme yapılır.'],
          ['Ağrı geçene kadar tam yatak istirahati öner', false, 'Uzun yatak istirahati iyileşmeyi geciktirir; aktif kalmak önerilir.']
        ]),
        TEST('slr', 'Fizyo Lab’de düz bacak kaldırma (Lasègue) testini 3B modelde izle; slump testiyle karşılaştır.')
      ] },

    /* ------------------------------ Ayak bileği burkulması ------------------------------ */
    { id: 'fz-ayak', vaka: 'ank', lab: 'fizyo', oda: 'fizyo', odaAd: 'Spor fizyoterapisi', baslik: 'Voleybolda ters basma',
      hasta: { ad: 'Elif', hitap: 'Elif', yas: 19, cins: 'K', gorunum: 'genc', kiyafet: '#4E9A6A', ifade: 'agri' }, mentor: FZT,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Smaçtan inerken arkadaşımın ayağına bastım, ayağım içe döndü. Dış tarafı çok şişti.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('yuk', 'Yaralandıktan hemen sonra basabildin mi, kaç adım yürüyebildin?', 'Aksayarak da olsa kendim yürüyüp çıktım.', 3, 'Yük verme|Hemen sonra yük verebildi.'),
          S('zaman', 'Ne zaman oldu?', 'Dün akşam antrenmanda.', 2, 'Zaman|≈1 gün.'),
          S('once', 'Daha önce aynı ayak bileği burkuldu mu?', 'Geçen sezon bir kez burkulmuştu.', 3, 'Öykü|Önceki burkulma (tekrarlama riski).'),
          S('ses', 'Ses geldi mi, ayak çok mu morardı?', 'Ses gelmedi, bugün dış tarafı morardı.', 1, 'Belirti|Ekimoz.'),
          S('ayakkabi', 'Hangi marka ayakkabı giyiyorsun?', 'Bilmiyorum, takımın verdiği.', 0),
          YARGI('hasta', 'Bileklik takmadığın için mi oldu?', 'Takmıyordum, evet…')
        ] },
        { tip: 'eylem', baslik: 'Muayene', yonerge: 'Ottawa ölçütlerine göre muayene et', secenek: [
          E('malleol', 'Lateral ve medial malleolün arka kenarına ve ucuna bas', 'Malleollerin arka kenarında kemik hassasiyeti yok.', 3, { geri: 'Ottawa ölçütü: malleol arka kenarı ya da ucunda hassasiyet.' }),
          E('ayak', 'Beşinci metatars tabanı ve naviküler kemiğe bas', 'Hassasiyet yok.', 3),
          E('yurume', 'Dört adım yürüt', 'Aksayarak dört adım yürüyebiliyor.', 3),
          E('atfl', 'Ön talofibular bağ bölgesini palpe et', 'Lateral malleolün önünde belirgin hassasiyet ve şişlik.', 2),
          E('kosu', 'Ağrının ne kadar olduğunu görmek için koştur', 'Elif’in yüzü buruştu.', -2, { geri: 'Akut dönemde yüklenme yaralanmayı ağırlaştırır.' })
        ] },
        K('Ottawa ayak bileği kuralları', 'Kemik hassasiyeti yok ve dört adım yürüyebiliyor. Grafi gerekir mi?', [
          ['Ottawa ölçütleri olumsuz: kırık olasılığı düşük, grafi gerekmez; bağ yaralanması olarak rehabilitasyona başlanır', true, 'Doğru. Ölçütler olumsuzsa gereksiz grafiden kaçınılır; tekrarlayan burkulmayı önlemek için denge ve kuvvet çalışması önemlidir.'],
          ['Her burkulmada grafi çekilmeli', false, 'Ottawa kuralları bu gereksiz grafileri azaltmak için geliştirilmiştir.'],
          ['Ağrı geçene kadar ayağı tamamen hareketsiz bırak', false, 'Erken kontrollü hareket ve yük verme iyileşmeyi hızlandırır.']
        ]),
        PROT('ank', 'Fizyo Lab’de ayak bileği lateral burkulması protokolünü aç; faz hedeflerini ve denge egzersizlerini incele.')
      ] },

    /* ============ 31.10.2026: Acadex Medica yeni hastaları ============ */
    /* ------------------------------ Kalça kırığından 6 hafta sonra (Fatma Hanım zinciri) ------------------------------ */
    { id: 'fz-kalca', vaka: 'trendelenburg', lab: 'fizyo', oda: 'fizyo', odaAd: 'Geriatrik rehabilitasyon', baslik: 'Kalça protezinden 6 hafta sonra yalpalama',
      hasta: { ad: 'Fatma Hanım', hitap: 'Fatma Hanım', yas: 82, cins: 'K', gorunum: 'yasli', ifade: 'endise' }, refakat: { ad: 'Kızı Ayşe Hanım', cins: 'K', gorunum: 'yetiskin', kiyafet: '#2E8E7E' }, mentor: FZT,
      adimlar: [
        { tip: 'konus', kim: 'refakat', metin: 'Ameliyattan sonra diyetisyenin dediklerini yaptık, kilosunu da toparladı. Ama annem yürürken iki yana sallanıyor, düşecek diye korkuyorum.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'yürüme bozukluğunu ve düşme riskini aydınlatan soruları seç', secenek: [
          S('ameliyat', 'Ameliyatta ne yapıldı, cerrahınız bir kısıtlama verdi mi?', 'Sağ kalçaya protez taktılar. Tam yük verebilirsin dediler.', 3, 'Cerrahi|Sağ parsiyel protez, tam yük serbest.'),
          S('dusme', 'Ameliyattan sonra düştünüz mü ya da düşer gibi oldunuz mu?', 'Banyoda iki kez tutundum, düşmedim.', 3, 'Düşme|Ameliyat sonrası 2 kez düşme eşiği.'),
          S('yardimci', 'Evde neyle yürüyorsunuz?', 'Yürüteçle; bazen bırakıyorum.', 2, 'Yardımcı cihaz|Yürüteç, düzensiz kullanım.'),
          S('agri', 'Ağrınız ne düzeyde?', 'Pek ağrım yok, yorgunluk var.', 1),
          S('torun', 'Torunlarınız sık geliyor mu?', 'Hafta sonları geliyorlar.', 0),
          YARGI('hasta', 'Yürüteci bırakmanız sorumsuzluk değil mi?', 'Ben de kendi başıma yürümek istiyorum…', 'Bağımsızlık isteği değerlidir; güvenli yürüyüş hedefi birlikte konur.')
        ] },
        { tip: 'eylem', baslik: 'Değerlendirme', yonerge: 'gerekenleri yap', secenek: [
          E('yuru', 'Yürüyüşünü gözle', 'Sağ bacak üzerinde dururken sol leğen kemiği aşağı düşüyor, gövdesini sağa eğiyor.', 3),
          E('kuvvet', 'Kalça abduktör kuvvetini test et', 'Sağ kalça abduksiyonu 3/5, sol 4/5.', 3),
          E('tug', 'Kalk ve yürü testi (Timed Up and Go)', '18 saniye: düşme riski yüksek.', 2, { deger: '18 sn' }),
          E('merdiven', 'Yardımsız merdiven inip çıkmasını iste', 'Fatma Hanım ilk basamakta dengesini kaybediyor; tutup oturtuyorsun.', -3, { ifade: 'endise', geri: 'Düşme riski yüksek hastada değerlendirme güvenli ortamda, destekle yapılır.' })
        ] },
        K('Değerlendirme', 'Gözlediğin yürüyüş örüntüsünü doğrulamak için hangi testi seçersin?', [
          ['Tek ayak üstünde leğen düzeyini izleyen test (Trendelenburg)', true, 'Doğru. Bu yürüyüş kalça abduktörlerinin (gluteus medius) yetersizliğini düşündürür; test bunu doğrular ve rehabilitasyon hedefini belirler.'],
          ['Lachman testi', false, 'Lachman diz ön çapraz bağını değerlendirir.'],
          ['Phalen testi', false, 'Phalen el bileği karpal tünelini değerlendirir.']
        ]),
        TEST('trendelenburg', 'Fizyo Lab’de testi 3B modelde uygula; hangi kasın, hangi sinirin sorumlu olduğunu incele.')
      ] },

    /* ------------------------------ Lateral epikondilit ------------------------------ */
    { id: 'fz-tenis', vaka: 'cozen', lab: 'fizyo', oda: 'fizyo', odaAd: 'El ve üst ekstremite rehabilitasyonu', baslik: 'Fare tutunca dirsek dışında ağrı',
      hasta: { ad: 'Aslı Hanım', hitap: 'Aslı Hanım', yas: 41, cins: 'K', gorunum: 'yetiskin', kiyafet: '#C8573A' }, mentor: FZT,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Grafik tasarımcıyım. İki aydır sağ dirseğimin dışı ağrıyor; çaydanlığı kaldırırken, fareyi tutarken batıyor.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'yükleme ve tanıyı aydınlatan soruları seç', secenek: [
          S('kavrama', 'Hangi hareketler ağrıyı artırıyor?', 'Bir şey kavrayıp kaldırınca, bileğimi geriye bükünce.', 3, 'Provokasyon|Kavrama ve bilek ekstansiyonuyla.'),
          S('is', 'Günde kaç saat bilgisayar başındasınız, mola veriyor musunuz?', 'On saat; mola pek vermiyorum.', 3, 'Yük|Günde 10 saat, molasız tekrarlı iş.'),
          S('uyusma', 'Elinizde uyuşma ya da karıncalanma var mı?', 'Yok.', 2, 'Nörolojik|Uyuşma yok (sinir basısı daha az olası).'),
          S('boyun', 'Boyun ağrınız var mı?', 'Arada tutulma oluyor ama ağrı dirsekte.', 1),
          S('hobi', 'Hafta sonu ne yaparsınız?', 'Yürüyüş.', 0),
          YARGI('hasta', 'Bu kadar çalışırsanız olur tabii, neden durmuyorsunuz?', 'Mecburum…', 'İş koşulunu yargılamak yerine ergonomi ve yük yönetimi birlikte planlanır.')
        ] },
        { tip: 'eylem', baslik: 'Muayene', yonerge: 'gerekenleri yap', secenek: [
          E('palp', 'Lateral epikondili palpe et', 'Lateral epikondilin hemen distalinde nokta hassasiyeti.', 3, { ifade: 'agri' }),
          E('kavrama', 'Ağrısız kavrama gücünü ölç', 'Sağda ağrısız kavrama 14 kg, solda 26 kg.', 2, { deger: '14 / 26 kg' }),
          E('bilek', 'Dirsek ve bilek eklem hareket açıklığına bak', 'Eklem açıklıkları tam.', 2),
          E('manip', 'Dirseği hızlı ve sert manipüle et', 'Aslı Hanım ağrıyla kolunu çekiyor.', -3, { ifade: 'agri', geri: 'Tendinopatide zorlayıcı manipülasyonun yeri yoktur.' })
        ] },
        K('Ön değerlendirme', 'Bulguları doğrulamak için hangi provokasyon testini seçersin?', [
          ['Dirençli bilek ekstansiyonunda lateral epikondil ağrısını arayan test (Cozen)', true, 'Doğru. Ekstansör kas kökü (özellikle ECRB) yüklenince ağrı tekrar oluşur.'],
          ['Thompson testi', false, 'Thompson Aşil tendonunu değerlendirir.'],
          ['Düz bacak kaldırma testi', false, 'Lomber kök basısını değerlendirir.']
        ]),
        TEST('cozen', 'Fizyo Lab’de testi 3B modelde uygula; hangi tendonun yüklendiğini gör.')
      ] },

    /* ------------------------------ Aşil tendonu ------------------------------ */
    { id: 'fz-asil', vaka: 'thompson', lab: 'fizyo', oda: 'fizyo', odaAd: 'Spor fizyoterapisi', baslik: 'Halı sahada “biri tekme attı sandım”',
      hasta: { ad: 'Mehmet Bey', hitap: 'Mehmet Bey', yas: 45, cins: 'E', gorunum: 'yetiskin', kiyafet: '#2E8E7E', ifade: 'agri' }, mentor: FZT,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Dün akşam halı sahada ileri fırladım, topuğumun üstüne biri tekme attı sandım. Arkama baktım, kimse yok.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('ses', 'O anda bir ses duydunuz mu, hemen basabildiniz mi?', '“Pat” diye bir ses geldi. Topallayarak çıktım, parmak ucuma kalkamıyorum.', 3, 'Mekanizma|Ani itiş, “pat” sesi, parmak ucuna kalkamama.'),
          S('ilac', 'Son zamanlarda antibiyotik ya da kortizon kullandınız mı?', 'Geçen ay idrar yolu için bir antibiyotik içtim; adını bilmiyorum.', 3, 'Risk|Yakın zamanda antibiyotik (florokinolon?) kullanımı.', null, 'Önemli: bazı antibiyotikler (florokinolonlar) ve kortikosteroidler tendon yırtığı riskini artırır.'),
          S('once', 'Daha önce o bölgede ağrınız var mıydı?', 'Sabahları biraz sertlik olurdu.', 2, 'Öncesi|Önceden sabah sertliği (tendinopati?).'),
          S('isinma', 'Maçtan önce ısındınız mı?', 'Pek değil.', 1),
          S('takim', 'Hangi takımı tutuyorsunuz?', 'Söylemesem daha iyi.', 0),
          YARGI('hasta', 'Bu yaşta halı saha mı olur?', 'Spor yapmayalım mı yani…', 'Aktif kalmak değerli; amaç güvenli dönüş planıdır.')
        ] },
        { tip: 'eylem', baslik: 'Muayene', yonerge: 'gerekenleri yap', secenek: [
          E('bak', 'Yüzüstü yatırıp iki ayağın duruşuna bak', 'Sağ ayak, solun aksine yerçekimiyle daha dik sarkıyor.', 3),
          E('palp', 'Tendon boyunca palpe et', 'Topuğun 4–5 cm üstünde belirgin çukurluk.', 3, { ifade: 'agri' }),
          E('ucu', 'Tek ayak parmak ucuna kalkmasını iste', 'Sağda kalkamıyor.', 1),
          E('germe', 'Ağrı geçsin diye baldırı zorla ger', 'Mehmet Bey ağrıyla bağırıyor; yırtık uzayabilir.', -3, { ifade: 'agri', geri: 'Tam kat yırtık şüphesinde germe yapılmaz.' })
        ] },
        K('Ön değerlendirme', 'Tam kat yırtık şüphesini doğrulamak için hangi testi seçersin, sonra ne yaparsın?', [
          ['Baldır sıkılınca ayağın plantar fleksiyonunu izleyen test (Thompson); aynı gün ortopedi değerlendirmesi', true, 'Doğru. Plantar fleksiyon olmuyorsa tendon tam kopmuştur; cerrahi ya da fonksiyonel ateli içeren tedavi kararı erken verilmelidir.'],
          ['Lachman testi; dizi bantla', false, 'Lachman ön çapraz bağ testidir; yakınma topukta.'],
          ['Ağrı kesici ve bir hafta sonra kontrol', false, 'Tam kat yırtık zaman kaybına gelmez.']
        ]),
        TEST('thompson', 'Fizyo Lab’de testi 3B modelde uygula; baldır kasları ile Aşil tendonunun ilişkisini incele.')
      ] },

    /* ------------------------------ Total diz protezi ------------------------------ */
    { id: 'fz-tda', vaka: 'tda', lab: 'fizyo', oda: 'fizyo', odaAd: 'Ortopedik rehabilitasyon', baslik: 'Diz protezinden 10 gün sonra',
      hasta: { ad: 'Nuriye Hanım', hitap: 'Nuriye Hanım', yas: 70, cins: 'K', gorunum: 'yasli', ifade: 'endise' }, refakat: { ad: 'Eşi Ali Bey', cins: 'E', gorunum: 'yasli', kiyafet: '#4E7AA8' }, mentor: FZT,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'On gün önce sol dizime protez taktılar. Dizimi bükmekten korkuyorum, açılır mı diye.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'rehabilitasyonu yönlendiren soruları seç', secenek: [
          S('yara', 'Yaranızda kızarıklık, akıntı ya da ateş var mı?', 'Yok, dikişler dün alındı.', 3, 'Yara|Temiz, dikişler alındı; enfeksiyon bulgusu yok.'),
          S('baldir', 'Baldırınızda şişlik, kızarıklık ya da ani ağrı oldu mu?', 'Hayır, olmadı.', 3, 'Tromboz|Derin ven trombozu bulgusu yok.', null, 'Önemli: artroplasti sonrası DVT erken dönemin en tehlikeli komplikasyonlarından biridir.'),
          S('egz', 'Evde hangi egzersizleri yapıyorsunuz?', 'Hastanede ayak bileği pompası öğrettiler, onu yapıyorum.', 2, 'Egzersiz|Yalnız ayak bileği pompası.'),
          S('agri', 'Ağrı kesicinizi egzersizden önce alıyor musunuz?', 'Hayır, ağrıdıkça alıyorum.', 2, 'Ağrı|Analjezik zamanlaması uygun değil.'),
          S('yemek', 'Hastanenin yemekleri nasıldı?', 'Tuzsuzdu.', 0),
          YARGI('hasta', 'Korkunuz abartılı değil mi?', 'Bilmiyorum, öyle mi…', 'Hareket korkusu (kinezyofobi) gerçektir; açıklama ve kademeli egzersizle azalır.')
        ] },
        { tip: 'eylem', baslik: 'Değerlendirme', yonerge: 'gerekenleri yap', secenek: [
          E('eha', 'Gonyometreyle diz fleksiyon ve ekstansiyonunu ölç', 'Fleksiyon 75°, ekstansiyonda −10° eksik.', 3, { ifade: 'agri', deger: '75° / −10°' }),
          E('quad', 'Kuadriseps kasılmasını ve düz bacak kaldırmayı değerlendir', 'Kuadriseps kasılması zayıf; düz bacak kaldırırken diz bükülüyor (ekstansör gecikmesi).', 3),
          E('sis', 'Diz çevresi ödemine bak', 'Hafif ödem; ısı artışı yok.', 2),
          E('zorla', 'Dizi bir seferde 120°’ye zorla bük', 'Nuriye Hanım ağlamaya başlıyor; kas savunması artıyor.', -3, { ifade: 'agri', geri: 'Zorlayıcı germe ağrı ve savunmayı artırır; açıklık kademeli kazanılır.' })
        ] },
        K('Plan', 'İlk iki haftanın rehabilitasyon önceliği ne olmalı?', [
          ['Tam ekstansiyonu kazanmak, kuadriseps aktivasyonu, ödem kontrolü ve kademeli fleksiyon; analjeziyi egzersizden önce planlamak', true, 'Doğru. Ekstansiyon eksikliği yürüyüşü bozar; kuadriseps aktivasyonu ve kontrollü açıklık çalışması erken dönemin temelidir.'],
          ['Protez sağlam olsun diye 6 hafta dizi hareket ettirmemek', false, 'Hareketsizlik yapışıklık ve tromboz riskini artırır.'],
          ['Hemen ağırlıkla squat ve koşu', false, 'Erken dönemde ağır yükleme uygun değildir.']
        ]),
        PROT('tda', 'Fizyo Lab’de total diz artroplastisi protokolünü aç; faz hedeflerini ve egzersiz geçiş ölçütlerini incele.')
      ] }
  ];
});
