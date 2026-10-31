/* ==========================================================================
   ACADEX KLİNİK · Anatomi / Fizyo Lab senaryoları (labs/klinik/senaryo-anatomi.js), 31.10.2026
   Anatomi ve Fizyo Lab'deki 5 klinik vaka (CASES: radial, supra, gluteal, femoral, pterion) için
   sahne: anamnez → muayene → klinik akıl yürütme → 3B modelde yapıları bulma (devir hedefi: 'model').
   Vakanın anatomik anahtarı ve açıklaması lab'daki CASES ile aynıdır. EĞİTİM AMAÇLIDIR; kurgusaldır.
   ========================================================================== */
(function (root, factory) {
  var L = factory();
  if (typeof module === 'object' && module.exports) module.exports = L;
  else if (root.AXKLINIK) root.AXKLINIK.ekle(L);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var DR = { ad: 'Deniz', unvan: 'Dr.', cins: 'K' };
  var S = function (id, t, cevap, puan, not, kim, geri) { return { id: id, t: t, cevap: cevap, puan: puan, not: not || null, kim: kim || null, geri: geri || null }; };
  var E = function (id, t, sonuc, puan, o) { return Object.assign({ id: id, t: t, sonuc: sonuc, puan: puan }, o || {}); };
  var K = function (soru, secenek) { return { tip: 'karar', baslik: 'Klinik akıl yürütme', soru: soru, secenek: secenek.map(function (x) { return { t: x[0], dogru: !!x[1], geri: x[2] }; }) }; };
  var MODEL = function (metin) { return { tip: 'devir', metin: metin, dugme: '3B modelde yapıları bul', hedef: 'model' }; };

  return [
    /* ------------------------------ Cumartesi gecesi felci ------------------------------ */
    { id: 'ana-radial', vaka: 'radial', lab: 'anatomi', oda: 'poliklinik', odaAd: 'Acil poliklinik', baslik: 'Cumartesi gecesi felci',
      hasta: { ad: 'Burak', hitap: 'Burak Bey', yas: 24, cins: 'E', gorunum: 'genc', kiyafet: '#3E6E9E', ifade: 'uzgun' }, mentor: DR,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Sabah uyandım, sağ bileğimi kaldıramıyorum. Elim aşağı sarkıyor, el sırtım da uyuşuk.' },
        { tip: 'konus', kim: 'mentor', metin: 'Yakınmayı anatomik bir düzeye bağlamaya çalış. Üç soru hakkın var.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'lezyon düzeyini düşündüren soruları seç', secenek: [
          S('nasil', 'Nasıl başladı, uyumadan önce ne oldu?', 'Dün gece arkadaşlarla içtik. Kolumu sandalyenin arkasına asıp öyle uyuyakalmışım.', 3, 'Öykü|Kol sandalye arkasına asılı uyuma (bası).'),
          S('his', 'Uyuşukluk tam olarak nerede?', 'El sırtında, özellikle başparmakla işaret parmağı arasında.', 3, 'Duyu|El sırtı radial yarısı, 1. web aralığı.'),
          S('travma', 'Düşme, darbe ya da ağrı var mı?', 'Hayır, düşmedim. Ağrı da yok, sadece güçsüzlük.', 2, 'Travma|Yok; ağrısız güçsüzlük.'),
          S('ilac', 'Düzenli kullandığınız ilaç var mı?', 'Yok.', 0),
          S('aile', 'Ailede sinir hastalığı olan var mı?', 'Bildiğim kadarıyla yok.', 0),
          S('yargi', 'Bu kadar içmeseniz olmaz mıydı?', 'Biliyorum… zaten pişmanım.', -2, null, null, 'Yargılayıcı yorum bilgi getirmez. Alkolü tarafsız sor; amacın bası süresini ve derin uykuyu anlamak.')
        ] },
        { tip: 'eylem', baslik: 'Nörolojik muayene', yonerge: 'gerekenleri yap', secenek: [
          E('bilek', 'Bilek ve parmak ekstansiyonunu test et', 'Bileğini ve parmaklarını kaldıramıyor: düşük el.', 3),
          E('triceps', 'Dirsek ekstansiyonunu (triceps) test et', 'Dirseğini güçlü açabiliyor: lezyon triceps dallarının çıkışından aşağıda.', 3, { geri: 'Çok değerli bir bulgu: lezyon düzeyini ayırt ettirir.' }),
          E('duyu', 'El sırtında duyu muayenesi', 'Başparmak ile işaret parmağı arasındaki el sırtı bölgesinde his azalmış.', 2),
          E('patella', 'Patella refleksine bak', 'Normal. Bu bulgu üst ekstremite vakasında kararını değiştirmez.', 0)
        ] },
        K('Sinir hangi düzeyde zarar görmüş olabilir?', [
          ['Humerusun arka yüzündeki spiral oluk (sulcus n. radialis) düzeyinde', true, 'Doğru. Bası burada olunca bilek-parmak ekstansörleri tutulur; triceps dalları daha yukarıdan çıktığı için dirsek ekstansiyonu çoğu zaman korunur.'],
          ['Koltuk altında (aksilla)', false, 'Aksiller düzeyde triceps de güçsüzleşirdi; hastada dirsek ekstansiyonu güçlü.'],
          ['Bilek düzeyinde', false, 'Bilekte yalnızca yüzeyel duyu dalı etkilenir; bilek ekstansiyonu korunurdu.']
        ]),
        MODEL('Şimdi 3B modelde sinirin sıkıştığı kemiği, siniri ve innerve ettiği kası bul.')
      ] },

    /* ------------------------------ Suprakondiler humerus kırığı ------------------------------ */
    { id: 'ana-supra', vaka: 'supra', lab: 'anatomi', oda: 'acil', odaAd: 'Çocuk acil', baslik: 'Suprakondiler humerus kırığı',
      hasta: { ad: 'Can', hitap: 'Can', yas: 7, cins: 'E', gorunum: 'cocuk', ifade: 'agri', sac: '#3A2A1E' }, refakat: { ad: 'Annesi', cins: 'K', gorunum: 'yetiskin', kiyafet: '#C8573A', ifade: 'uzgun' }, mentor: DR, vital: { nabiz: 124, ta: '102/64', spo2: 99 },
      adimlar: [
        { tip: 'konus', kim: 'refakat', metin: 'Parkta düştü, dirseği şişti. Kolunu hiç oynatmıyor, çok ağlıyor.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('mek', 'Nasıl düştü, nereye yaslandı?', 'Kaydıraktan düştü, açık elinin üstüne düştü.', 3, 'Mekanizma|Açık el üzerine düşme (FOOSH).', 'refakat'),
          S('parmak', 'Parmaklarında uyuşma, soğukluk ya da renk değişikliği var mı?', 'Parmaklarım karıncalanıyor, elim soğuk gibi.', 3, 'Nörovasküler|Karıncalanma, soğukluk.', 'hasta'),
          S('zaman', 'Ne kadar zaman önce oldu?', 'Bir saat kadar önce.', 2, 'Süre|≈1 saat.', 'refakat'),
          S('kirik', 'Daha önce kemik kırığı oldu mu?', 'Hayır, ilk defa.', 0, null, 'refakat'),
          S('asi', 'Aşıları tam mı?', 'Evet, tam.', 0, null, 'refakat'),
          S('yargi', 'Çocuğa neden göz kulak olmadınız?', 'Yanındaydım, bir anda oldu…', -2, null, 'refakat', 'Suçlayıcı soru aileyi savunmaya iter ve bilgi akışını keser.')
        ] },
        { tip: 'eylem', baslik: 'Muayene', yonerge: 'gerekenleri yap', secenek: [
          E('nabiz', 'Radial nabzı ve kapiller dolumu değerlendir', 'Radial nabız zayıf; kapiller dolum 3 saniye.', 3, { anim: 'monitor' }),
          E('ok', 'Parmak hareketleri: “OK” işareti yaptır', 'Başparmak ile işaret parmağının ucunu birleştiremiyor (n. medianus / ön interosseöz dal).', 3),
          E('ziyar', 'Dirseği zorlayarak hareket ettir', 'Can bağırıyor; monitörde nabız yükseliyor.', -3, { anim: 'monitor', vital: { nabiz: 148 }, alarm: { nabiz: true }, geri: 'Kırıkta zorlamak damar ve siniri daha da gerebilir; kol olduğu pozisyonda atele alınır.' }),
          E('agri', 'Ağrı skalası sor', 'Yüz skalasında 8/10.', 1)
        ] },
        K('Nabız zayıf ve parmaklar soğuk. Önceliğin ne?', [
          ['Kolu zorlamadan atele al, acil ortopedi; nörovasküler durumu sık izle, kompartman sendromuna dikkat', true, 'Doğru. Nabız kaybı ve önkolda artan ağrı Volkmann iskemik kontraktürü açısından acil uyarıdır.'],
          ['Ağrı kesici verip ertesi gün kontrole çağır', false, 'Nörovasküler bulgu varken beklemek kalıcı hasara yol açabilir.'],
          ['Kolu düzeltip sıkı sargıyla sar', false, 'Sıkı sargı ve zorlayıcı redüksiyon dolaşımı daha da bozar.']
        ]),
        MODEL('3B modelde kırılan kemiği, sıkışabilecek arteri ve siniri bul.')
      ] },

    /* ------------------------------ Yanlış yerden kalça iğnesi ------------------------------ */
    { id: 'ana-gluteal', vaka: 'gluteal', lab: 'anatomi', oda: 'fizyo', odaAd: 'Fizik tedavi polikliniği', baslik: 'Yanlış yerden kalça iğnesi',
      hasta: { ad: 'Sevgi', hitap: 'Sevgi Hanım', yas: 46, cins: 'K', gorunum: 'yetiskin', kiyafet: '#5E8F4A', ifade: 'agri' }, mentor: DR,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Geçen hafta kalçamdan iğne oldum. O andan beri bacağımın arkasından ayağıma kadar elektrik çarpar gibi ağrı var, ayağım da güçsüz.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('yer', 'İğne kalçanın tam olarak neresine yapıldı?', 'Kalçanın iç-alt tarafına yapıldı, hemşire acelesi vardı.', 3, 'Enjeksiyon|Kalçanın iç-alt çeyreği.'),
          S('yayilim', 'Ağrı nereye yayılıyor?', 'Uyluğun arkasından dizin arkasına, oradan ayağıma.', 3, 'Yayılım|Uyluk arkası → ayak.'),
          S('an', 'Belirtiler ne zaman başladı?', 'İğne yapılırken elektrik çarpmış gibi oldu, hemen ardından başladı.', 2, 'Başlangıç|Enjeksiyon anında.'),
          S('bel', 'Daha önce bel ağrısı ya da bel fıtığı oldu mu?', 'Hayır, belim hiç ağrımadı.', 2, 'Ayırıcı tanı|Bel ağrısı öyküsü yok.'),
          S('ilac', 'Neden iğne yapıldı?', 'Grip için ağrı kesici iğnesiydi.', 0)
        ] },
        { tip: 'eylem', baslik: 'Muayene', yonerge: 'gerekenleri yap', secenek: [
          E('diz', 'Diz fleksiyonunu test et', 'Dizini bükerken güçsüz: hamstring kasları etkilenmiş.', 3),
          E('ayak', 'Ayak bileği hareketlerini test et', 'Ayağını yukarı da aşağı da tam hareket ettiremiyor; yürürken ayak düşüyor.', 3),
          E('slr', 'Düz bacak kaldırma testi', 'Belden kaynaklanan sinir kökü germe bulgusu yok.', 2, { geri: 'Bel fıtığını ayırt etmeye yardım eder.' }),
          E('iz', 'Enjeksiyon yerine bak', 'Kalçanın iç-alt çeyreğinde iğne izi.', 2)
        ] },
        K('Kalçaya kas içi enjeksiyon nereden yapılmalıydı?', [
          ['Dış-üst çeyrekten ya da ventrogluteal bölgeden', true, 'Doğru. N. ischiadicus kalçanın iç-alt çeyreğinden geçer; dış-üst çeyrek ve ventrogluteal bölge bu sinirden uzaktır.'],
          ['Kalçanın tam ortasından', false, 'Orta bölge sinirin seyrine yakın olabilir.'],
          ['İç-alt çeyrekten', false, 'Tam olarak n. ischiadicus\'un geçtiği yer.']
        ]),
        MODEL('3B modelde enjeksiyon yapılan kası, zarar gören siniri ve uylukta innerve ettiği kas grubunu bul.')
      ] },

    /* ------------------------------ Femoral kateter girişi ------------------------------ */
    { id: 'ana-femoral', vaka: 'femoral', lab: 'anatomi', oda: 'ameliyathane', odaAd: 'Anjiyografi laboratuvarı', baslik: 'Femoral kateter girişi',
      hasta: { ad: 'Ahmet', hitap: 'Ahmet Bey', yas: 62, cins: 'E', gorunum: 'yasli', uyanik: true }, mentor: DR, vital: { nabiz: 78, ta: '134/80', spo2: 97 },
      adimlar: [
        { tip: 'konus', kim: 'anlatici', metin: 'Ahmet Bey koroner anjiyografi için masada. Lokal anestezi yapılacak; giriş kasıktan.' },
        { tip: 'konus', kim: 'hasta', metin: 'Doktor hanım, çok ağrır mı? Biraz korkuyorum.' },
        { tip: 'sor', baslik: 'İşlem öncesi sorgu', hak: 3, yonerge: 'güvenlik için en önemlileri', secenek: [
          S('kan', 'Kan sulandırıcı kullanıyor musunuz?', 'Aspirin ve klopidogrel kullanıyorum.', 3, 'İlaç|Aspirin + klopidogrel (kanama riski).'),
          S('alerji', 'Daha önce ilaç boyasına (kontrast) alerjiniz oldu mu?', 'Geçen yıl tomografi çekildi, bir şey olmadı.', 3, 'Alerji|Kontrastla sorun yaşamamış.'),
          S('bobrek', 'Böbrek hastalığınız var mı?', 'Hayır, tahlillerim normalmiş.', 2, 'Böbrek|Bilinen hastalık yok.'),
          S('aclik', 'En son ne zaman yemek yediniz?', 'Gece yarısından beri aç kaldım.', 1),
          S('aile', 'Babanızda kalp hastalığı var mıydı?', 'Babam kalp krizi geçirdi.', 0)
        ] },
        { tip: 'eylem', baslik: 'Giriş noktası', yonerge: 'doğru sırayla düşün', secenek: [
          E('nabiz', 'Kasık bağının altında femoral nabzı palpe et', 'Kasık bağının yaklaşık orta noktasının hemen altında güçlü nabız.', 3),
          E('nav', 'Lateralden mediale yapıları sırala', 'Sinir, arter, ven (NAV): arter ortada.', 3, { kim: 'mentor' }),
          E('distal', 'Ayak nabızlarını işaretle', 'Dorsalis pedis ve tibialis posterior nabızları alınıyor; işlem sonrası karşılaştırma için işaretlendi.', 2),
          E('yuksek', 'Kasık bağının üstünden gir', 'Mentor durduruyor: monitörde tansiyon düşüyor.', -3, { anim: 'monitor', vital: { ta: '92/58', nabiz: 112 }, alarm: { ta: true, nabiz: true }, geri: 'Kasık bağının üstünden giriş retroperitoneal kanama riskidir; bası uygulanamaz.' })
        ] },
        K('Kateterin giriş noktası neresi olmalı?', [
          ['Kasık bağının 1–2 cm altında, femoral nabzın tam üzerinde', true, 'Doğru. Burada arter femur başının üzerindedir ve işlem sonrası bası uygulanabilir.'],
          ['Nabzın 1–2 cm medialinde', false, 'Medialde v. femoralis vardır.'],
          ['Nabzın 1–2 cm lateralinde', false, 'Lateralde n. femoralis vardır; hasarında diz ekstansiyonu zayıflar.']
        ]),
        MODEL('3B modelde arteri, lateralindeki siniri ve bu sinirin hasarında güçsüzleşen kası bul.')
      ] },

    /* ------------------------------ Şakağa darbe ------------------------------ */
    { id: 'ana-pterion', vaka: 'pterion', lab: 'anatomi', oda: 'acil', odaAd: 'Acil servis', baslik: 'Şakağa darbe',
      hasta: { ad: 'Emre', hitap: 'Emre', yas: 19, cins: 'E', gorunum: 'genc', ifade: 'uyku', konusamaz: true }, refakat: { ad: 'Antrenörü', cins: 'E', gorunum: 'yetiskin', kiyafet: '#2E8E5B', ifade: 'uzgun' }, mentor: DR, vital: { nabiz: 56, ta: '166/94', spo2: 96 },
      adimlar: [
        { tip: 'konus', kim: 'anlatici', metin: 'Emre sedyede; uyandırınca gözlerini açıyor ama hemen dalıyor.' },
        { tip: 'konus', kim: 'refakat', metin: 'Maçta top şakağına çarptı. Birkaç saniye bayıldı ama sonra kalktı, oyunu bile izledi. Şimdi böyle oldu.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'olayın zaman çizelgesini kur', secenek: [
          S('olay', 'Darbe tam olarak nereye geldi, ne kadar bayıldı?', 'Sağ şakağına, çok sert. Birkaç saniye bayıldı.', 3, 'Olay|Sağ şakağa darbe, kısa bilinç kaybı.', 'refakat'),
          S('sonra', 'Uyandıktan sonra nasıldı?', 'Gayet iyiydi, konuştu, güldü. Kendi yürüdü.', 3, 'Seyir|Düzelme dönemi (lusid aralık).', 'refakat'),
          S('kotu', 'Ne zaman ve nasıl kötüleşti?', 'İki üç saat sonra başım çok ağrıyor dedi, kustu, sonra uyumaya başladı.', 3, 'Kötüleşme|2–3 saat sonra baş ağrısı, kusma, uyuklama.', 'refakat'),
          S('ilac', 'Düzenli ilaç kullanıyor mu?', 'Hayır.', 0, null, 'refakat'),
          S('alkol', 'Alkol ya da madde aldı mı?', 'Hayır, maçtaydık.', 1, null, 'refakat')
        ] },
        { tip: 'eylem', baslik: 'Hızlı değerlendirme', yonerge: 'zaman kritik', secenek: [
          E('gks', 'Glasgow Koma Skalası', 'GKS 11 (göz 3, sözel 3, motor 5: emirlere uymuyor, ağrıyı lokalize ediyor). Olay yerinde 15 idi.', 3),
          E('pupil', 'Pupillere bak', 'Sağ pupil geniş ve ışığa yavaş yanıt veriyor.', 3),
          E('monitor', 'Monitörü değerlendir', 'Nabız 56, TA 166/94: kafa içi basınç artışını düşündürür (Cushing yanıtı).', 2, { anim: 'monitor' }),
          E('uyut', '“Uyusun, sabah bakarız” de', 'Mentor durduruyor; monitörde nabız daha da düşüyor.', -3, { anim: 'monitor', vital: { nabiz: 48 }, alarm: { nabiz: true }, geri: 'Lusid aralıktan sonra bilinç bozulması acildir; beklemek ölümcül olabilir.' })
        ] },
        K('Ön tanın ve önceliğin ne?', [
          ['Epidural hematom (a. meningea media yaralanması); acil BT ve beyin cerrahisi', true, 'Doğru. Pterion ince bir bölgedir; altından a. meningea media geçer. Klasik tablo kısa bilinç kaybı, düzelme ve sonra hızlı kötüleşmedir.'],
          ['Basit sarsıntı; ağrı kesici ve eve gönder', false, 'Lusid aralık ve lateralize bulgu (tek taraflı geniş pupil) basit sarsıntıyla açıklanamaz.'],
          ['Migren atağı; karanlık odada dinlendir', false, 'Travma sonrası bilinç bozulması acil görüntüleme gerektirir.']
        ]),
        MODEL('3B modelde darbenin geldiği kemik yapıyı ve kanayan arterin geldiği ana arteri bul.')
      ] }
  ];
});
