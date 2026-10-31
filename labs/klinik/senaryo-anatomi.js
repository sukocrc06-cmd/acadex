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
  var YARGI = function (kim, t, cevap, geri) { return S('yargi', t, cevap, -2, null, kim, geri || 'Suçlayıcı ya da küçümseyen soru güveni sarsar ve bilgi akışını keser.'); };
  var MODEL = function (metin) { return { tip: 'devir', metin: metin, dugme: '3B modelde yapıları bul', hedef: 'model' }; };

  /* ---------- lab sonrası: hastaya bildir (Acadex Medica, 31.10.2026) ----------
     3B modelde yapıları bulduktan sonra öğrenci hastaya (ya da yakınına) ne olduğunu anlatır.
     Doğru seçenek doğru ve anlaşılır olandır; terim yığını ve yanlış güvence ayrı ayrı geri bildirim alır. */
  var JARGON = 'Tıbbi olarak doğru ama hasta anlamaz. Terimleri gündelik dile çevir.';
  var SONU = {
    'ana-radial': { sorular: [{ s: 'Burak Bey soruyor: “Elim düzelecek mi, ne oldu bana?”', secenek: [
      ['N. radialis sulcus nervi radialis düzeyinde nöropraksi; ekstansör kompartman etkilenmiş.', false, JARGON],
      ['Kolunuzun arkasından geçen bir sinir uzun süre sıkışmış; bileği kaldıran kaslara giden sinyal geçici olarak kesilmiş. Çoğu zaman haftalar içinde düzelir; bu sürede bileği destekleyen atel ve egzersiz yapacağız.', true, 'Doğru ve anlaşılır; beklentiyi de gerçekçi kurdun.'],
      ['Kalıcı felç oldu, yapılacak bir şey yok.', false, 'Yanlış ve korkutucu: bası sonrası sinir hasarı çoğunlukla düzelir.']] }] },
    'ana-supra': { sorular: [{ s: 'Annesi soruyor: “Neden hemen ameliyata alıyorsunuz?”', secenek: [
      ['Kırık kemiğin ucu, kola kan götüren damara ve bir sinire bastırıyor; elinin nabzı zayıf. Kemiği hemen yerine oturtup sabitlemek damarı ve eli korumak için gerekli.', true, 'Doğru: aciliyetin nedenini anlaşılır anlattın.'],
      ['Gartland tip 3 suprakondiler kırık, a. brachialis kompresyonu ve Volkmann riski var.', false, JARGON],
      ['Acele yok, yarın sabah da olur.', false, 'Nabız zayıfken beklemek kalıcı hasar riskidir.']] }] },
    'ana-gluteal': { sorular: [{ s: 'Sevgi Hanım soruyor: “İğne yanlış yere mi yapıldı?”', secenek: [
      ['Hayır, sizin sinirleriniz hassas, o kadar.', false, 'Olayı örtmek güveni bozar. İstenmeyen olaylar açık ve dürüst anlatılır.'],
      ['N. ischiadicus’ta enjeksiyona bağlı nöropati gelişmiş; gluteal bölgenin iç-alt kadranı riskli.', false, JARGON],
      ['Kalçanın iç-alt bölümünden bacağa inen büyük bir sinir geçiyor; iğne ona yakın yapılmış ve siniri etkilemiş. Bunu kayda geçiriyoruz; nöroloji ile birlikte güç ve hissi düzenli izleyeceğiz.', true, 'Doğru: dürüst, anlaşılır ve bir plan içeriyor.']] }] },
    'ana-femoral': { sorular: [{ s: 'Ahmet Bey soruyor: “İşlemden sonra neden bacağımı oynatmamalıyım?”', secenek: [
      ['Kateter kasıktaki büyük atardamardan girdi. Delik kapanana kadar bacağınızı düz tutarsanız kanama olmaz. Hemen yanındaki sinir ve toplardamarı da kontrol edeceğiz.', true, 'Doğru ve anlaşılır.'],
      ['Önemli değil, hemen kalkıp yürüyebilirsiniz.', false, 'Giriş yerinde kanama ve hematom riski vardır.'],
      ['A. femoralis ponksiyonu sonrası hemostaz için ekstremite immobilizasyonu gerekir.', false, JARGON]] }] },
    'ana-pterion': { sorular: [{ s: 'Antrenörü soruyor: “Bayılıp kendine gelmişti, şimdi ne oldu?”', secenek: [
      ['Biraz baş ağrısı; sabaha geçer, eve götürebilirsiniz.', false, 'Yanlış güvence: bilinç yeniden bozuldu, bu acildir.'],
      ['Şakaktaki ince kemiğin altında beyin zarına giden bir damar var; darbeyle yırtılmış ve kafatası içinde kanama yapmış. Hemen ameliyatla kan boşaltılacak; ne kadar erken olursa o kadar iyi. Ailesine haber verelim.', true, 'Doğru: durumu, aciliyeti ve sonraki adımı anlattın.'],
      ['Pterion kırığına bağlı a. meningea media kaynaklı epidural hematom.', false, JARGON]] }] },
    'ana-inme': { sorular: [{ s: 'Kızı Elif Hanım soruyor: “Babama ne oldu?”', secenek: [
      ['Beynin sol tarafına giden bir damar tıkanmış; o bölge sağ kolu, bacağı ve konuşmayı yönetiyor. Tedavi ve rehabilitasyonla iyileşme olabilir. Yutması da etkilendiği için şimdilik ağızdan bir şey vermeyeceğiz.', true, 'Doğru: neden, beklenti ve güvenlik uyarısı bir arada.'],
      ['Sol a. cerebri media sulama alanında iskemik infarkt.', false, JARGON],
      ['Beyin kanaması oldu, artık yapılacak bir şey yok.', false, 'Yanlış: görüntüleme iskemik inmeyi gösteriyor; umut kırıcı ve hatalı.']] }] },
    'ana-kalca': { sorular: [{ s: 'Fatma Hanım soruyor: “Kemiğim kaynar mı kızım?”', secenek: [
      ['Collum femoris kırığı; caput femoris’in kanlanması bozulabilir, artroplasti planlanıyor.', false, JARGON],
      ['Yaşlılarda kırık kaynamaz, bundan sonra yatakta kalacaksınız.', false, 'Yanlış ve umut kırıcı: ameliyattan sonra erken ayağa kalkmak hedeftir.'],
      ['Uyluk kemiğinin kalçaya yakın boyun kısmı kırılmış. Bu bölgenin kanlanması kolay bozulduğu için çoğu zaman protezle onarılır. Ameliyattan sonra erken ayağa kalkmanız ve iyi beslenmeniz iyileşmeyi hızlandırır.', true, 'Doğru: tedaviyi ve sizin de katkınızı anlattın.']] }] },
    'ana-apandisit': { sorular: [{ s: 'Can Bey soruyor: “Ameliyat şart mı?”', secenek: [
      ['Kalın bağırsağın başlangıcındaki apandis iltihaplanmış. Patlamadan önce ameliyatla alınması gerekiyor; çoğu zaman kapalı yöntemle yapılır ve birkaç günde toparlanırsınız.', true, 'Doğru ve anlaşılır.'],
      ['Gaz sancısı; ağrı kesici alıp eve gidin.', false, 'Periton irritasyonu olan hastada yanlış güvence tehlikelidir.'],
      ['Akut apandisit, McBurney hassasiyeti ve rebound pozitif; apendektomi endikasyonu var.', false, JARGON]] }] },
    'ana-kot': { sorular: [{ s: 'Serkan Bey soruyor: “Göğsüme ne oldu, neden nefes alamıyorum?”', secenek: [
      ['Sağ hemopnömotoraks, toraks tüpü endikasyonu ve olası hepatik laserasyon.', false, JARGON],
      ['Kaburgalarınız kırılmış; biri akciğer zarını delip göğüs boşluğuna hava kaçırmış, akciğeriniz tam açılamıyor. Göğsünüze küçük bir tüp takıp havayı boşaltacağız. Karaciğerinizi de görüntülemeyle kontrol edeceğiz.', true, 'Doğru: ne olduğunu ve ne yapılacağını anlattın.'],
      ['Basit kas ağrısı, nefes egzersizi yaparsınız geçer.', false, 'SpO₂ %89 ve hipersonorite acil müdahale gerektirir.']] }] }
  };

  var L = [
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
      ] },

    /* ============ 31.10.2026: Acadex Medica yeni hastaları (Osman Bey ve Fatma Hanım konsültasyon zincirlerinin ilk halkası) ============ */
    /* ------------------------------ Sabah fark edilen inme ------------------------------ */
    { id: 'ana-inme', vaka: 'inme', lab: 'anatomi', oda: 'acil', odaAd: 'Acil servis · inme alanı', baslik: 'Sabah fark edilen inme',
      hasta: { ad: 'Osman Bey', hitap: 'Osman Bey', yas: 72, cins: 'E', gorunum: 'yasli', sac: '#C9C4BA', konusamaz: true, ifade: 'endise' }, refakat: { ad: 'Kızı Elif Hanım', cins: 'K', gorunum: 'yetiskin', kiyafet: '#7A4FA8' }, mentor: DR,
      vital: { nabiz: 96, ta: '178/98', spo2: 95, ritim: 'duzensiz' },
      adimlar: [
        { tip: 'konus', kim: 'refakat', metin: 'Babam sabah kahvaltıda birden konuşamadı, sağ eli bardağı tutamadı. Su verdik, öksürdü.' },
        { tip: 'konus', kim: 'mentor', metin: 'İnmede zaman beyindir. Önce en kritik bilgiyi al; üç soru hakkın var.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'tedavi kararını değiştirecek soruları seç', secenek: [
          S('saat', 'En son ne zaman tamamen sağlıklı görüldü?', 'Dün gece 23.00’te yattı, iyiydi. Sabah 07.30’da böyle bulduk.', 3, 'Son iyi görülme|23.00; belirtiler 07.30’da fark edildi.', 'refakat'),
          S('ilac', 'Kan sulandırıcı kullanıyor mu?', 'Hayır, sadece tansiyon ilacı. Ara ara da unutuyor.', 3, 'İlaç|Antikoagülan yok; antihipertansif düzensiz.', 'refakat'),
          S('ritim', 'Daha önce kalp ritim bozukluğu söylendi mi?', 'Geçen yıl “kalbin düzensiz atıyor” dediler ama ilaç başlanmadı.', 3, 'Kalp|Bilinen düzensiz ritim, tedavisiz.', 'refakat'),
          S('seker', 'Şekeri var mı, bugün ölçtünüz mü?', 'Şekeri yok; ambulansta 118 ölçtüler.', 2, 'Glukoz|118 mg/dL (hipoglisemi dışlandı).', 'refakat'),
          S('meslek', 'Emekli olmadan önce ne iş yapıyordu?', 'Marangozdu.', 0, null, 'refakat'),
          YARGI('refakat', 'Neden hemen getirmediniz, saatlerce beklemişsiniz?', 'Uyandığında böyleydi… gece olduğunu bilmiyorduk.', 'Suçlayıcı soru zaman kazandırmaz; son iyi görülme saatini tarafsız sor.')
        ] },
        { tip: 'eylem', baslik: 'Nörolojik muayene', yonerge: 'gerekenleri yap', secenek: [
          E('yuz', 'Yüz, kol ve konuşmaya bak (hızlı inme taraması)', 'Sağ ağız köşesi düşük, sağ kol yerçekimine karşı kalkmıyor; anlaşılır sözcük yok.', 3),
          E('glukoz', 'Parmak ucu kan şekerini doğrula', 'Glukoz 118 mg/dL.', 2, { deger: '118 mg/dL' }),
          E('monitor', 'Monitörü ve ritmi değerlendir', 'Nabız düzensiz, 96/dk; TA 178/98, SpO₂ %95.', 2, { anim: 'monitor' }),
          E('su', 'Yutabiliyor mu diye bir bardak su ver', 'Osman Bey suyu yutarken boğuluyor gibi öksürüyor; SpO₂ düşüyor.', -3, { anim: 'monitor', vital: { spo2: 90, nabiz: 112 }, alarm: { spo2: true }, ifade: 'agri', geri: 'Yutma taraması yapılmadan ağızdan su verilmez; aspirasyon riski yüksek.' })
        ] },
        K('Bulgular hangi damar alanını düşündürür ve ilk adım ne olmalı?', [
          ['Sol a. cerebri media alanı; acil beyin görüntülemesi ve inme ekibi, ağızdan hiçbir şey verilmeden yutma taraması', true, 'Doğru. Sağ yüz-kol güçsüzlüğü ve konuşamama sol (dominant) yarıküreyi gösterir. Kanama ayrımı için önce görüntüleme; yutma taraması DKT ile yapılır.'],
          ['Sağ a. cerebri media alanı; hemen ağızdan aspirin verilir', false, 'Bulgular sağ tarafta: lezyon sol yarıkürede. Kanama dışlanmadan ve yutma değerlendirilmeden ağızdan ilaç verilmez.'],
          ['Beyincik inmesi; yürüme testi yapılır', false, 'Afazi ve yüz-kol güçsüzlüğü kortikal bir tabloyu gösterir.']
        ]),
        MODEL('3B modelde emboli kaynağı arteri, etkilenen beyin bölümünü ve motor yolun indiği yapıyı bul.')
      ] },

    /* ------------------------------ Evde düşen yaşlı kadın ------------------------------ */
    { id: 'ana-kalca', vaka: 'kalca', lab: 'anatomi', oda: 'acil', odaAd: 'Acil servis · travma', baslik: 'Evde düşen yaşlı kadın',
      hasta: { ad: 'Fatma Hanım', hitap: 'Fatma Hanım', yas: 82, cins: 'K', gorunum: 'yasli', ifade: 'agri' }, refakat: { ad: 'Kızı Ayşe Hanım', cins: 'K', gorunum: 'yetiskin', kiyafet: '#2E8E7E' }, mentor: DR,
      vital: { nabiz: 98, ta: '142/80', spo2: 96 },
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Mutfakta ayağım kaydı, yan düştüm. Kalkamıyorum kızım, kalçam çok ağrıyor.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'kırığı ve riskleri aydınlatan soruları seç', secenek: [
          S('nasil', 'Düşmeden önce başınız döndü mü, bayıldınız mı?', 'Hayır, ayağım kaydı. Başımı da çarpmadım.', 3, 'Mekanizma|Mekanik düşme; senkop ve kafa travması yok.'),
          S('ilac', 'Hangi ilaçları kullanıyorsunuz, kan sulandırıcı var mı?', 'Tansiyon ilacı. Kan sulandırıcı yok.', 3, 'İlaç|Antikoagülan yok (ameliyat zamanlaması için önemli).'),
          S('once', 'Düşmeden önce evde kendi başınıza yürüyebiliyor muydunuz?', 'Bastonla yürürdüm, işlerimi kendim görürdüm.', 2, 'İşlev|Bastonla bağımsız.'),
          S('kilo', 'Son aylarda iştahınız, kilonuz nasıl?', 'İki ayda epey zayıfladım, pek yiyemiyorum.', 2, 'Beslenme|2 ayda belirgin kilo kaybı.', null, 'Değerli: beslenme riski ameliyat sonrası iyileşmeyi etkiler; diyetisyene konsültasyon gerekebilir.'),
          S('tv', 'En sevdiğiniz dizi hangisi?', 'Akşam haberlerini izlerim.', 0),
          YARGI('hasta', 'Bu yaşta neden tek başınıza mutfağa giriyorsunuz?', 'Kendi evimde de mi oturacağım…', 'Bağımsızlığı yargılamak yerine düşme önleme planı birlikte kurulur.')
        ] },
        { tip: 'eylem', baslik: 'Muayene', yonerge: 'gerekenleri yap', secenek: [
          E('bacak', 'Bacakların boyuna ve duruşuna bak', 'Sağ bacak kısa ve dışa dönük (eksternal rotasyon).', 3, { ifade: 'agri' }),
          E('nabiz', 'Ayak nabızlarını ve duyuyu kontrol et', 'A. dorsalis pedis nabzı alınıyor, duyu korunmuş.', 2),
          E('agri', 'Ağrı kesici iste ve bacağı destekle', 'Analjezi yapıldı, bacak yastıkla desteklendi; Fatma Hanım biraz rahatladı.', 2, { ifade: 'rahat', vital: { nabiz: 88 } }),
          E('yurut', 'Kırık var mı anlamak için ayağa kaldırıp yürüt', 'Fatma Hanım çığlık atıyor; ağrıyla nabzı yükseliyor.', -3, { ifade: 'agri', vital: { nabiz: 118 }, alarm: { nabiz: true }, geri: 'Kırık şüphesinde yük verdirilmez; önce görüntüleme.' })
        ] },
        K('Kısa ve dışa dönük bacakta en olası yaralanma ve en önemli risk nedir?', [
          ['Collum femoris kırığı; femur başının kanlanmasının bozulması (avasküler nekroz)', true, 'Doğru. Femur başını besleyen a. circumflexa femoris medialis dalları kırıkta yırtılabilir; bu yüzden yaşlıda çoğunlukla protez yapılır.'],
          ['Kalça çıkığı; hemen yerine oturtulur', false, 'Yaşlıda basit düşmede en sık neden kırıktır; görüntülemeden manipülasyon yapılmaz.'],
          ['Kas zorlanması; dinlenme yeterli', false, 'Kısa ve dışa dönük bacak kırığın klasik bulgusudur.']
        ]),
        MODEL('3B modelde kırılan kemiği, eklem yuvasını taşıyan kemiği ve femur başını besleyen arteri bul.')
      ] },

    /* ------------------------------ Göç eden karın ağrısı ------------------------------ */
    { id: 'ana-apandisit', vaka: 'apandisit', lab: 'anatomi', oda: 'poliklinik', odaAd: 'Acil cerrahi poliklinik', baslik: 'Göç eden karın ağrısı',
      hasta: { ad: 'Can', hitap: 'Can Bey', yas: 19, cins: 'E', gorunum: 'genc', kiyafet: '#3E6E9E', ifade: 'agri' }, mentor: DR, vital: { nabiz: 104, ta: '122/76', spo2: 98, ates: 37.9 },
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Dün akşam göbeğimin etrafı ağrımaya başladı. Sabah ağrı sağ alta kaydı, yürürken daha kötü.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'ayırıcı tanıyı daraltan soruları seç', secenek: [
          S('istah', 'İştahınız nasıl, bulantı ya da kusma oldu mu?', 'Hiç iştahım yok, bir kez kustum.', 3, 'Belirti|İştahsızlık, bir kez kusma.'),
          S('gocme', 'Ağrı başladığı yerde mi kaldı, yer değiştirdi mi?', 'Göbekteydi, şimdi sağ alt tarafta. Öksürünce de batıyor.', 3, 'Ağrı|Göbek çevresinden sağ alt kadrana göç.'),
          S('idrar', 'İdrar yaparken yanma ya da kan oldu mu?', 'Hayır, idrarım normal.', 2, 'Ayırıcı|Üriner yakınma yok.'),
          S('ates', 'Ateşiniz oldu mu?', 'Sabah biraz üşüdüm.', 1),
          S('spor', 'Hangi sporu yapıyorsunuz?', 'Basketbol.', 0),
          YARGI('hasta', 'Dışarıda ne yediniz, yine abur cubur mu?', 'Normal yemek yedim…', 'Yargılamak yerine son yemeği ve kusma özelliğini tarafsız sor.')
        ] },
        { tip: 'eylem', baslik: 'Karın muayenesi', yonerge: 'gerekenleri yap', secenek: [
          E('mcb', 'McBurney noktasında derin palpasyon', 'McBurney noktasında belirgin hassasiyet ve defans.', 3, { ifade: 'agri' }),
          E('rebound', 'Geri bırakma (rebound) hassasiyetine bak', 'Elini çekince ağrı artıyor: periton irritasyonu.', 2, { ifade: 'agri' }),
          E('ates', 'Ateşini ölç', 'Ateş 37,9 °C.', 1, { deger: '37,9 °C' }),
          E('lavman', 'Kabızlık olabilir diye lavman öner', 'Lavman akut karında perforasyon riskini artırır; Can Bey endişeli.', -3, { ifade: 'endise', geri: 'Akut karın şüphesinde lavman ve laksatif verilmez.' })
        ] },
        K('Ağrının göbekten sağ alt kadrana göçünü nasıl açıklarsın?', [
          ['Önce visseral ağrı (T10, göbek çevresi), iltihap pariyetal peritona ulaşınca lokal ağrı: akut apandisit düşünülür, cerrahi konsültasyon', true, 'Doğru. Visseral lifler ağrıyı orta hatta, pariyetal periton ise tam yerinde hissettirir.'],
          ['Böbrek taşı; ağrı kesici verip eve gönder', false, 'İdrar yakınması yok, periton irritasyonu var.'],
          ['Gastroenterit; bol sıvı yeterli', false, 'Göç eden ağrı, defans ve rebound akut karın bulgusudur.']
        ]),
        MODEL('3B modelde apendiksin bağlı olduğu bağırsağı, ona açılan ince bağırsağı ve McBurney noktasının referans kemiğini bul.')
      ] },

    /* ------------------------------ Motosiklet kazası ------------------------------ */
    { id: 'ana-kot', vaka: 'kot', lab: 'anatomi', oda: 'acil', odaAd: 'Acil servis · kırmızı alan', baslik: 'Motosiklet kazası, göğüs travması',
      hasta: { ad: 'Serkan', hitap: 'Serkan Bey', yas: 35, cins: 'E', gorunum: 'yetiskin', ifade: 'agri', maske: true }, mentor: DR, vital: { nabiz: 118, ta: '108/70', spo2: 89 },
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Motordan düştüm… sağ tarafım… nefes alınca bıçak gibi giriyor.' },
        { tip: 'konus', kim: 'mentor', metin: 'Monitör alarm veriyor. Kısa sor, hızlı muayene et; üç soru hakkın var.' },
        { tip: 'sor', baslik: 'Hızlı anamnez', hak: 3, yonerge: 'en kritik bilgileri al', secenek: [
          S('carp', 'Neresi çarptı, kask var mıydı?', 'Sağ yanıma düştüm, kask vardı. Kafam iyi.', 3, 'Mekanizma|Sağ göğüs üstüne düşme; kask var.'),
          S('nefes', 'Nefes darlığı giderek artıyor mu?', 'Evet, gittikçe zorlaşıyor.', 3, 'Solunum|Artan nefes darlığı.'),
          S('karin', 'Karnınızda ağrı var mı?', 'Sağ üst tarafta da ağrı var.', 2, 'Karın|Sağ üst kadran ağrısı.'),
          S('ilac', 'Düzenli ilaç kullanıyor musunuz?', 'Hayır.', 1),
          S('is', 'Ne iş yapıyorsunuz?', 'Kuryeyim.', 0),
          YARGI('hasta', 'Yine hız yaptınız herhalde?', 'Kaygan zemindi…', 'Travmada suçlayıcı soru vakit kaybettirir.')
        ] },
        { tip: 'eylem', baslik: 'Birincil bakı', yonerge: 'hayati olanları yap', secenek: [
          E('dinle', 'İki akciğeri dinle ve perküsyon yap', 'Sağda solunum sesleri azalmış, perküsyonda hipersonorite.', 3),
          E('o2', 'Yüksek akımlı oksijen ver', 'Maske ile oksijen başlandı; SpO₂ %93’e çıktı.', 3, { anim: 'monitor', vital: { spo2: 93 }, ifade: 'normal' }),
          E('palp', 'Göğüs duvarını nazikçe palpe et', 'Sağ 6–9. kaburgalarda krepitasyon ve hassasiyet.', 2, { ifade: 'agri' }),
          E('otur', 'Rahat nefes alsın diye yürüterek koridora çıkar', 'Serkan Bey baş dönmesiyle sendeliyor; SpO₂ düşüyor.', -3, { anim: 'monitor', vital: { spo2: 86, nabiz: 128 }, alarm: { spo2: true, nabiz: true }, ifade: 'endise', geri: 'Hemodinamisi bozulmaya yatkın travma hastası yürütülmez.' })
        ] },
        K('Sağda azalmış solunum sesi ve hipersonorite: en olası tablo ve ek risk?', [
          ['Kaburga kırığına bağlı pnömotoraks; alt sağ kaburgalar nedeniyle karaciğer yaralanması da araştırılmalı', true, 'Doğru. Tansiyon bulguları (hipotansiyon, trakea kayması) gelişirse dekompresyon bekletilmez. Alt sağ kaburga kırıklarında karaciğer, solda dalak yaralanması akla gelir.'],
          ['Kalp krizi; EKG yeterli', false, 'Mekanizma travma; akciğer bulguları göğüs duvarı ve plevrayı gösterir.'],
          ['Basit kas ağrısı; ağrı kesiciyle eve', false, 'SpO₂ %89 ve hipersonorite acil müdahale gerektirir.']
        ]),
        MODEL('3B modelde kırılan yapıyı, yaralanabilecek organı ve sağ alt kaburgaların koruduğu organı bul.')
      ] }
  ];
  /* ilk plan (31.10.2026): yapıları bulduktan sonra öğrenci önce ekibe planı söyler, sonra hastaya anlatır.
     Taburcu sahnesinde hastaya söylenen, SON sorudaki (açıklama) seçimdir; plan sorusu bu yüzden başa eklenir. */
  var PLAN = {
    'ana-radial': ['Bileği nötral tutan atel, eklem açıklığı egzersizleri ve birkaç hafta içinde kontrol; düzelme yoksa elektrofizyolojik inceleme', 'Acil sinir onarımı ameliyatı', 'Hiçbir şey yapmadan taburcu, kendiliğinden geçer', ['Doğru: bası nöropraksisi çoğunlukla düzelir; atel ve egzersiz bileği korur, düzelme yoksa ENMG istenir.', 'Bası nöropraksisinde sinir kopuk değildir; cerrahi ilk basamak değildir.', 'Atel ve izlem olmadan bilek kontraktürü ve düşme riski artar.']],
    'ana-supra': ['Acil ortopedi: kapalı redüksiyon ve tel ile tespit; nabız, el dolaşımı ve kompartman bulgularını yakın izlem', 'Alçıya alıp ertesi gün kontrol', 'Ağrı kesici verip eve gönder', ['Doğru: nabzı zayıf yer değiştirmiş kırık acil redüksiyon ister; kompartman sendromu kaçırılmamalı.', 'Nabız zayıfken beklemek arter ve sinir hasarını kalıcı yapabilir.', 'Deformite ve nabız zayıflığı ayaktan izlenmez.']],
    'ana-gluteal': ['Olayı kayda geçir; nöroloji konsültasyonu, güç ve duyu izlemi, gerekirse ENMG; fizyoterapi ve düşme önlemi', 'Aynı bölgeye tekrar enjeksiyon yapıp ağrıyı geçir', 'Bir şey söylemeden taburcu et', ['Doğru: istenmeyen olay açıkça kaydedilir; sinir işlevi izlenir ve rehabilitasyon başlar.', 'Aynı bölgeye yeniden enjeksiyon siniri daha da zedeleyebilir.', 'Olayı gizlemek hasta güvenliği ve etik açısından yanlıştır.']],
    'ana-femoral': ['Nabızla arteri bul, girişi kasık bağının altından yap; işlem sonrası kanama, hematom ve bacak nabızlarını izle', 'Girişi kasık bağının üstünden yap, daha kolay', 'Nabzın medialinden, ven üzerinden gir', ['Doğru: kasık bağının altında arter femur başı üzerinde bastırılabilir; işlem sonrası hematom ve distal nabız izlenir.', 'Bağın üstünden giriş bastırılamayan retroperitoneal kanama riskidir.', 'Arterin medialinde ven bulunur; yanlış damara girilir.']],
    'ana-pterion': ['Acil BT ve beyin cerrahisi; bilinç ve pupillerin sık izlemi, ağızdan bir şey verilmez', 'Gözlemde tut, sabah BT çek', 'Ağrı kesici verip eve gönder', ['Doğru: lusid aralık sonrası kötüleşme epidural hematomu düşündürür; dakikalar önemlidir.', 'Epidural hematom saatler içinde ölümcül olabilir; beklenmez.', 'Bilinci bozulan travma hastası eve gönderilmez.']],
    'ana-inme': ['Acil beyin görüntülemesi ve inme ekibi; kanama yoksa zaman penceresine göre damar açıcı tedavi; ağızdan bir şey vermeden yutma taraması (DKT)', 'Önce ağızdan aspirin ver, görüntüleme bekleyebilir', 'Tansiyonu hemen normale indir, sonra eve gönder', ['Doğru: önce kanama dışlanır; tedavi kararı zamana bağlıdır. Yutma taraması yapılmadan ağızdan bir şey verilmez.', 'Kanama dışlanmadan ve yutma değerlendirilmeden ağızdan ilaç verilmez.', 'Akut inmede kan basıncı hızla düşürülmez; hasta yatırılır.']],
    'ana-kalca': ['Ağrı kontrolü, kalça grafisi; ortopedi ile 24–48 saat içinde ameliyat; beslenme taraması ve erken mobilizasyon planı', 'Yatak istirahati, ameliyat gerekmez', 'Ağrı geçince ayağa kaldırıp eve gönder', ['Doğru: yaşlıda kalça kırığında erken cerrahi ve erken mobilizasyon komplikasyonları azaltır; beslenme riski de taranır.', 'Uzun yatak istirahati bası yarası, tromboz ve pnömoni riskidir.', 'Kırık şüphesinde yük verdirilmez.']],
    'ana-apandisit': ['Ağızdan bir şey verme, damar yolu ve sıvı; kan tetkikleri ve görüntüleme; genel cerrahi konsültasyonu', 'Lavman yapıp eve gönder', 'Antibiyotik reçete edip ayaktan izle', ['Doğru: akut karın şüphesinde ameliyat olasılığına göre hazırlık yapılır, cerrah değerlendirir.', 'Lavman akut karında perforasyon riskini artırır.', 'Cerrahi değerlendirme olmadan ayaktan izlem uygun değildir.']],
    'ana-kot': ['Oksijen ve monitör; acil akciğer grafisi ya da ultrason, pnömotoraksta göğüs tüpü; karın içi kanama için değerlendirme', 'Kaburgaları sıkı bandajla sar', 'Ağrı kesiciyle eve gönder', ['Doğru: pnömotoraks tüple boşaltılır; alt sağ kaburga kırığında karaciğer yaralanması da araştırılır.', 'Sıkı bandaj solunumu kısıtlar ve pnömoni riskini artırır.', 'SpO₂ %89 olan travma hastası eve gönderilmez.']]
  };
  /* doğru seçenek hep başta durmasın: sırayı vakaya göre sabit biçimde döndür */
  var planSoru = function (p, k) { var o = [[p[0], true, p[3][0]], [p[1], false, p[3][1]], [p[2], false, p[3][2]]]; k = k % 3; return { s: 'Ekip soruyor: “İlk plan ne?”', secenek: o.slice(k).concat(o.slice(0, k)) }; };
  L.forEach(function (x) { var so = SONU[x.id] || null; if (so && PLAN[x.id]) so = Object.assign({}, so, { sorular: [planSoru(PLAN[x.id], x.id.length)].concat(so.sorular) }); x.sonu = so; });
  return L;
});
