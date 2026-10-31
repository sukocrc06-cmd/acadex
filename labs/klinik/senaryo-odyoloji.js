/* ==========================================================================
   ACADEX KLİNİK · Odyoloji Lab senaryoları (labs/klinik/senaryo-odyoloji.js), 31.10.2026
   Odyoloji Lab vaka masasındaki 13 vaka (odyo-model.js → CASES) için Acadex Medica sahnesi:
   karşılama → anamnez → kulak muayenesi (otoskopi, diyapazon) → ölçüm planı kararı →
   vaka masasına devir (hedef 'vaka': test iste, kabinde ölç, tanı ve yönlendirme).
   Öykü ve otoskopi bulgusu vaka dosyasıyla AYNIDIR (tests/medica.js denetler).
   Sahnedeki karar tanıyı söylemez; tanı ve yönlendirme vaka masasında puanlanır.
   Diyapazon (Rinne/Weber) sonuçları vakanın kayıp tipiyle uyumludur.
   EĞİTİM AMAÇLIDIR; vakalar kurgusaldır.
   ========================================================================== */
(function (root, factory) {
  var L = factory();
  if (typeof module === 'object' && module.exports) module.exports = L;
  else if (root.AXKLINIK) root.AXKLINIK.ekle(L);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var ODY = { ad: 'Ece', unvan: 'Ody.', cins: 'K' };
  var S = function (id, t, cevap, puan, not, kim, geri) { return { id: id, t: t, cevap: cevap, puan: puan, not: not || null, kim: kim || null, geri: geri || null }; };
  var E = function (id, t, sonuc, puan, o) { return Object.assign({ id: id, t: t, sonuc: sonuc, puan: puan }, o || {}); };
  var K = function (soru, secenek) { return { tip: 'karar', baslik: 'Ölçüm planı', soru: soru, secenek: secenek.map(function (x) { return { t: x[0], dogru: !!x[1], geri: x[2] }; }) }; };
  var MASA = function (metin) { return { tip: 'devir', metin: metin, dugme: 'Vaka masasına geç', hedef: 'vaka' }; };
  var YARGI = function (kim, t, cevap, geri) { return S('yargi', t, cevap, -2, null, kim, geri || 'Suçlayıcı ya da küçümseyen soru güveni sarsar ve bilgi akışını keser.'); };

  return [
    /* ------------------------------ Seröz otitis media ------------------------------ */
    { id: 'ody-v-ome', vaka: 'v-ome', lab: 'odyoloji', oda: 'odyo', odaAd: 'Çocuk odyolojisi', baslik: '6 yaşında çocuk: "seslenince bakmıyor"',
      hasta: { ad: 'Efe', hitap: 'Efe', yas: 6, cins: 'E', gorunum: 'cocuk', sac: '#3A2A1E', kiyafet: '#4E9A6A' }, refakat: { ad: 'Annesi', cins: 'K', gorunum: 'yetiskin', kiyafet: '#C8573A' }, mentor: ODY,
      adimlar: [
        { tip: 'konus', kim: 'refakat', metin: 'İki haftadır seslenince bakmıyor. Televizyonu da çok yüksek açıyor, sınıfta öğretmeni de söyledi.' },
        { tip: 'konus', kim: 'mentor', metin: 'Çocuklarda işitme yakınması çoğu zaman aileden gelir. Ne zaman ve neyin ardından başladığını öğren; üç soru hakkın var.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('once', 'Bu yakınmadan önce hasta oldu mu, nezle ya da grip geçirdi mi?', 'Üç hafta önce nezle olmuştu, öksürüğü de vardı.', 3, 'Öncesi|3 hafta önce üst solunum yolu enfeksiyonu.', 'refakat'),
          S('akinti', 'Ateşi, kulak ağrısı ya da kulak akıntısı oldu mu?', 'Hayır, ateşi yok. Kulağından akıntı da gelmedi.', 3, 'Belirti|Ateş ve akıntı yok.', 'refakat'),
          S('sure', 'Ne zamandır böyle?', 'İki hafta kadar oldu.', 2, 'Süre|≈2 hafta.', 'refakat'),
          S('dogum', 'Doğumu nasıldı, yenidoğan işitme taramasından geçti mi?', 'Normal doğum, taramadan geçti.', 1, 'Geçmiş|Yenidoğan taraması geçti.', 'refakat'),
          S('okul', 'Okulda arkadaşlarıyla arası nasıl?', 'İyi, arkadaşları çok.', 0, null, 'refakat'),
          YARGI('refakat', 'Siz de hep televizyonu yüksek açıyor olmayasınız?', 'Hayır, sadece o açıyor…')
        ] },
        { tip: 'eylem', baslik: 'Kulak muayenesi', yonerge: 'gerekenleri yap', secenek: [
          E('oyun', 'Efe’yle oyun kurarak işbirliğini sağla', 'Efe, kulaklıktan gelen sesi duyunca kutuya boncuk atmayı öğrendi.', 2, { geri: 'Bu yaşta oyun odyometrisi güvenilir eşik almayı sağlar.' }),
          E('otoskopi', 'Otoskopla iki kulağa bak', 'Her iki kulak zarı mat, hafif içe çekik; ışık refleksi seçilmiyor, zar arkasında sıvı seviyesi şüphesi.', 3),
          E('diyapazon', 'Diyapazonla Rinne ve Weber yap', 'Efe ne sorulduğunu anlamakta zorlanıyor; bu yaşta diyapazon yanıtları güvenilir değil.', 0),
          E('zorla', 'Kıpırdamasın diye başını tutup kulaklığı zorla tak', 'Efe ağlamaya başladı, kulaklığı çıkarıyor.', -2, { geri: 'Zorlamak işbirliğini bozar ve ölçümü güvenilmez kılar.' })
        ] },
        K('Bu çocukta ölçüm planı ne olmalı?', [
          ['Otoskopi, timpanometri ve yaşa uygun (oyun) saf ses odyometrisi; gerekirse refleks ve konuşma testleri', true, 'Doğru. Mat zar ve yakın zamanda geçirilmiş enfeksiyon orta kulağı düşündürüyor; timpanometri orta kulağı, odyometri kaybın derecesini gösterir.'],
          ['Önce sedasyonla ABR çekilsin', false, 'İşbirliği yapabilen 6 yaşındaki çocukta ilk basamak davranışsal odyometri ve immitanstır.'],
          ['Ölçüme gerek yok, kulak temizliği yeterli', false, 'Zar arkasında sıvı şüphesi var; kaybın tipi ve derecesi ölçülmeden karar verilmez.']
        ]),
        MASA('Vaka masasında testleri iste; timpanometri ve refleksi kabinde kendin ölç, sonra tanı ve yönlendirmeyi yaz.')
      ] },

    /* ------------------------------ Otoskleroz ------------------------------ */
    { id: 'ody-v-oto', vaka: 'v-oto', lab: 'odyoloji', oda: 'odyo', odaAd: 'Odyoloji polikliniği', baslik: '34 yaşında kadın: yavaş artan işitme azlığı',
      hasta: { ad: 'Merve Hanım', hitap: 'Merve Hanım', yas: 34, cins: 'K', gorunum: 'yetiskin', kiyafet: '#7A4FA8' }, mentor: ODY,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'İki yıldır iki kulağımda da işitmem azalıyor. Toplantılarda sürekli “efendim” diyorum.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'kayıp tipini düşündüren soruları seç', secenek: [
          S('gurultu', 'Gürültülü ortamda mı, sessiz ortamda mı daha iyi duyuyorsunuz?', 'Garip ama kalabalıkta, gürültülü yerde daha iyi duyuyorum.', 3, 'Paracusis|Gürültüde daha iyi duyma (paracusis Willisii).'),
          S('gebelik', 'Ne zaman belirginleşti, hayatınızda bir değişiklik oldu mu?', 'Gebeliğimden sonra iyice arttı.', 3, 'Seyir|Gebelikten sonra belirginleşmiş.'),
          S('aile', 'Ailede işitme kaybı olan var mı?', 'Annemde de var, o işitme cihazı kullanıyor.', 3, 'Aile|Annede işitme kaybı.'),
          S('akinti', 'Kulak akıntısı ya da ağrısı oldu mu?', 'Hiç olmadı.', 1, 'Akıntı|Yok.'),
          S('kahve', 'Günde kaç kahve içiyorsunuz?', 'İki fincan.', 0),
          YARGI('hasta', 'Dikkat etmediğiniz için mi kaçırıyorsunuz?', 'Hayır, gerçekten duyamıyorum.')
        ] },
        { tip: 'eylem', baslik: 'Kulak muayenesi', yonerge: 'gerekenleri yap', secenek: [
          E('otoskopi', 'Otoskopla iki kulağa bak', 'Her iki kulak zarı normal görünümde. Sağda promontoryumda pembe yansıma (Schwartze bulgusu) şüphesi.', 3),
          E('rinne', 'Rinne testi (512 Hz)', 'İki kulakta da kemik yolu hava yolundan daha uzun duyuluyor: Rinne negatif.', 3, { geri: 'Rinne negatifliği iletim tipi kaybı düşündürür.' }),
          E('weber', 'Weber testi', 'Sesi başın ortasında duyuyor.', 2, { geri: 'Simetrik iletim kaybında Weber ortada kalır.' }),
          E('lavaj', 'Kulak yoluna su ile lavaj yap', 'Kulak yolu zaten temiz; gereksiz girişim hastayı rahatsız etti.', -1, { geri: 'Buşon yokken lavaj gerekmez.' })
        ] },
        K('Muayene normal zar ve negatif Rinne gösteriyor. Ölçüm planın ne?', [
          ['Hava ve kemik yolu saf ses odyometrisi (maskeleme ile), timpanometri ve akustik refleks', true, 'Doğru. Hava-kemik aralığı iletim tipini gösterir; normal zarla birlikte refleks bulguları stapesin hareketini anlatır.'],
          ['Yalnızca hava yolu odyometrisi yeterli', false, 'Kemik yolu olmadan iletim tipi kayıp gösterilemez.'],
          ['Önce MR çekilsin', false, 'Simetrik, yavaş ilerleyen ve iletim tipi düşündüren tabloda ilk adım audiyolojik test bataryasıdır.']
        ]),
        MASA('Vaka masasında testleri iste, refleksi kabinde ölç; tanı ve yönlendirmeyi yaz.')
      ] },

    /* ------------------------------ Presbiakuzi ------------------------------ */
    { id: 'ody-v-presbi', vaka: 'v-presbi', lab: 'odyoloji', oda: 'odyo', odaAd: 'Odyoloji polikliniği', baslik: '68 yaşında erkek: "duyuyorum ama anlamıyorum"',
      hasta: { ad: 'Kemal Bey', hitap: 'Kemal Bey', yas: 68, cins: 'E', gorunum: 'yasli', kiyafet: '#4E7AA8' }, refakat: { ad: 'Eşi', cins: 'K', gorunum: 'yasli', kiyafet: '#B26A8A' }, mentor: ODY,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Duyuyorum aslında, ama torunlarım konuşunca anlamıyorum. Kalabalıkta hiç anlamıyorum.' },
        { tip: 'konus', kim: 'refakat', metin: 'Televizyonun sesini o kadar açıyor ki komşular rahatsız oluyor.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('baslangic', 'Nasıl başladı, iki kulakta eşit mi?', 'Yavaş yavaş oldu, iki kulakta da aynı gibi.', 3, 'Seyir|Yavaş, iki taraflı, simetrik.'),
          S('anlama', 'En çok hangi durumlarda zorlanıyorsunuz?', 'İnce sesleri, çocuk seslerini, bir de kalabalıkta konuşulanı anlamıyorum.', 3, 'Anlama|Gürültüde ve tiz seslerde zorluk.'),
          S('gurultu', 'Gürültülü bir işte çalıştınız mı?', 'Hayır, memurdum.', 2, 'Gürültü|Mesleki gürültü yok.'),
          S('vertigo', 'Baş dönmesi ya da kulak çınlaması var mı?', 'Arada hafif çınlama, baş dönmesi yok.', 1, 'Eşlik|Hafif çınlama.'),
          S('emekli', 'Ne zaman emekli oldunuz?', 'On yıl oldu.', 0),
          YARGI('hasta', 'Yaşlılıkta herkes böyle olur, neden geldiniz?', 'Ama ailemle konuşamıyorum…', 'Yakınmayı küçümsemek tedaviden uzaklaştırır; işitme kaybı tedavi edilmezse yalnızlaşma ve bilişsel yük artar.')
        ] },
        { tip: 'eylem', baslik: 'Kulak muayenesi', yonerge: 'gerekenleri yap', secenek: [
          E('otoskopi', 'Otoskopla iki kulağa bak', 'Her iki dış kulak yolu ve kulak zarı doğal.', 3),
          E('rinne', 'Rinne testi', 'İki kulakta hava yolu kemik yolundan uzun: Rinne pozitif.', 2),
          E('weber', 'Weber testi', 'Sesi başın ortasında duyuyor.', 2),
          E('yuksek', 'Konuşurken ona doğru bağırarak konuş', 'Kemal Bey irkildi; bağırmak sesi bozar, anlamayı artırmaz.', -1, { geri: 'Yüzünü görerek, net ve normalden biraz yavaş konuşmak bağırmaktan daha iyidir.' })
        ] },
        K('Yakınma "duyuyorum ama anlamıyorum". Ölçüm planın ne?', [
          ['Saf ses odyometrisi ile birlikte konuşmayı alma eşiği ve konuşmayı ayırt etme skoru', true, 'Doğru. Anlama yakınmasında eşiklerin yanında konuşmayı ayırt etme ölçülmelidir; cihaz beklentisi de buna göre konuşulur.'],
          ['Önce ABR ile beyin sapı yanıtına bakılsın', false, 'Simetrik, yavaş ilerleyen kayıpta ilk basamak davranışsal testlerdir; ABR burada gereksizdir.'],
          ['Ölçmeden işitme cihazı dene', false, 'Cihaz ayarı ölçülen eşiklere göre yapılır.']
        ]),
        MASA('Vaka masasında testleri iste, konuşma testini kabinde kendin uygula; tanı ve yönlendirmeyi yaz.')
      ] },

    /* ------------------------------ Gürültüye bağlı kayıp ------------------------------ */
    { id: 'ody-v-gurultu', vaka: 'v-gurultu', lab: 'odyoloji', oda: 'odyo', odaAd: 'İş sağlığı odyolojisi', baslik: '45 yaşında fabrika işçisi: kulak çınlaması',
      hasta: { ad: 'Murat Bey', hitap: 'Murat Bey', yas: 45, cins: 'E', gorunum: 'yetiskin', kiyafet: '#2F5F8A' }, mentor: ODY,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'İki kulağımda sürekli tiz bir çınlama var. Gece sessizlikte daha çok duyuyorum.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('is', 'Ne iş yapıyorsunuz, ortam gürültülü mü?', '20 yıldır metal işleme atölyesindeyim. Makineler çok gürültülü.', 3, 'Maruziyet|20 yıl metal atölyesi.'),
          S('koruyucu', 'Kulak koruyucu kullanıyor musunuz?', 'Var ama düzenli takmıyorum, konuşmayı duyamıyorum.', 3, 'Koruyucu|Düzensiz kullanım.'),
          S('son', 'Bugün işten mi geldiniz, en son ne zaman gürültüdeydiniz?', 'Dün akşam vardiyadaydım, bugün izinliyim.', 2, 'Son maruziyet|Dün akşam; ≥14 saat dinlenme şartı sağlanıyor.'),
          S('isitme', 'İşitmenizde azalma fark ettiniz mi?', 'Pek fark etmedim, sadece çınlama.', 1, 'İşitme|Fark etmemiş.'),
          S('sigara', 'Sigara kullanıyor musunuz?', 'Günde yarım paket.', 0),
          YARGI('hasta', 'Koruyucu takmadığınız için kendi suçunuz değil mi?', 'Biliyorum ama çok rahatsız ediyor…', 'Suçlamak yerine neden takmadığını anla; konuşmayı engellemeyen koruyucu seçenekleri var.')
        ] },
        { tip: 'eylem', baslik: 'Kulak muayenesi', yonerge: 'gerekenleri yap', secenek: [
          E('otoskopi', 'Otoskopla iki kulağa bak', 'Her iki kulak doğal.', 3),
          E('rinne', 'Rinne testi', 'İki kulakta Rinne pozitif.', 2),
          E('weber', 'Weber testi', 'Sesi ortada duyuyor.', 1),
          E('maksimum', 'Çınlamayı bastırmak için testi en yüksek şiddetten başlat', 'Murat Bey irkildi, çınlaması arttı.', -2, { geri: 'Eşik araması rahat duyulan bir düzeyden başlayıp kademeli yapılır; yüksek şiddet akustik travma riskidir.' })
        ] },
        K('Mesleki gürültü maruziyeti olan bu işçiyi ölçmeden önce neye dikkat edersin?', [
          ['Ölçümden önce en az 14 saat gürültüsüz dinlenmiş olmalı; 3–6 kHz bölgesi dahil tüm frekanslar ölçülür', true, 'Doğru. Geçici eşik kayması kalıcı kaybı olduğundan büyük gösterir; temel odyogram dinlenmiş kulakla alınır.'],
          ['Vardiyadan hemen sonra ölçmek daha gerçekçi olur', false, 'Hemen sonra geçici eşik kayması ölçülür; kalıcı kayıp olduğundan kötü görünür.'],
          ['Yalnızca konuşma frekanslarını (500–2000 Hz) ölçmek yeter', false, 'Gürültü hasarı ilk 3–6 kHz bandında (özellikle 4 kHz) görülür; bu bant atlanırsa kayıp gözden kaçar.']
        ]),
        MASA('Vaka masasında testleri iste; odyogramdaki çentiği yorumla, tanı ve yönlendirmeyi yaz.')
      ] },

    /* ------------------------------ Ani sensörinöral kayıp ------------------------------ */
    { id: 'ody-v-ani', vaka: 'v-ani', lab: 'odyoloji', oda: 'odyo', odaAd: 'Odyoloji polikliniği', baslik: '52 yaşında kadın: sabah uyanınca sol kulak duymuyor',
      hasta: { ad: 'Sevgi Hanım', hitap: 'Sevgi Hanım', yas: 52, cins: 'K', gorunum: 'yetiskin', kiyafet: '#C8573A', ifade: 'uzgun' }, mentor: ODY,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'İki gün önce sabah uyandım, sol kulağım duymuyordu. Bir de çınlıyor.' },
        { tip: 'konus', kim: 'mentor', metin: 'Ne zaman başladığı burada çok önemli. Soruların zamanı ve eşlik eden belirtileri yakalamalı.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('zaman', 'Tam olarak ne zaman fark ettiniz, birden mi oldu?', 'İki gün önce sabah, birden. Akşam yatarken hiçbir şey yoktu.', 3, 'Başlangıç|2 gün önce, ani.'),
          S('denge', 'Baş dönmesi ya da dengesizlik var mı?', 'Hafif bir baş dönmesi var.', 2, 'Eşlik|Hafif baş dönmesi.'),
          S('travma', 'Kafa travması, yüksek ses ya da yakın zamanda enfeksiyon oldu mu?', 'Hiçbiri olmadı.', 3, 'Neden|Travma, gürültü, enfeksiyon yok.'),
          S('once', 'Daha önce işitme sorununuz var mıydı?', 'Hayır, iki kulağım da iyi duyardı.', 2, 'Önceki|İşitme normaldi.'),
          S('stres', 'İş yerinde stres yaşıyor musunuz?', 'Biraz yoğunum.', 0),
          YARGI('hasta', 'Neden iki gün beklediniz, hemen gelmeniz gerekmez miydi?', 'Geçer sandım…', 'Gecikmeyi suçlamak geri getirmez; hemen yönlendirmeye odaklan.')
        ] },
        { tip: 'eylem', baslik: 'Kulak muayenesi', yonerge: 'gerekenleri yap', secenek: [
          E('otoskopi', 'Otoskopla iki kulağa bak', 'Her iki kulak zarı doğal.', 3),
          E('weber', 'Weber testi', 'Sesi sağ kulağında duyuyor.', 3, { geri: 'Weber sağlam (sağ) tarafa kayıyor: sol kulakta sensörinöral kayıp düşündürür.' }),
          E('rinne', 'Rinne testi', 'Sol kulakta da hava yolu kemik yolundan uzun (Rinne pozitif), ama ikisi de zayıf duyuluyor.', 2),
          E('bekle', 'Bir hafta sonra kontrole çağır', 'Mentor başını iki yana sallıyor.', -3, { geri: 'Ani işitme kaybında zaman kritiktir; ölçüm aynı gün yapılır, hasta beklemeye bırakılmaz.' })
        ] },
        K('Sol kulak sağdan çok daha kötü. Ölçümde neye dikkat edersin?', [
          ['Karşı (sağ) kulağı maskeleyerek ölç; maskesiz eşikler gölge eğri verir', true, 'Doğru. Kötü kulak ölçülürken iyi kulak sesi kafatası yoluyla duyar; maskeleme olmadan sol eşikler olduğundan iyi görünür.'],
          ['Maskeleme gerekmez, iki kulak ayrı ayrı ölçülür', false, 'İki kulak arası fark büyükse ses karşı kulağa geçer (kafa içi aktarım); maskeleme şarttır.'],
          ['Yalnızca sağ kulağı ölçmek yeterli', false, 'Yakınma sol kulakta; kaybın tipi ve derecesi iki kulakta da gösterilmeli.']
        ]),
        MASA('Vaka masasında testleri iste ve sonuçları yorumla; tanı ve yönlendirmeyi yaz. Zamanın önemli olduğunu unutma.')
      ] },

    /* ------------------------------ Ménière ------------------------------ */
    { id: 'ody-v-meniere', vaka: 'v-meniere', lab: 'odyoloji', oda: 'odyo', odaAd: 'Odyoloji ve denge polikliniği', baslik: '40 yaşında kadın: dönme atakları ve dolgunluk',
      hasta: { ad: 'Aslı Hanım', hitap: 'Aslı Hanım', yas: 40, cins: 'K', gorunum: 'yetiskin', kiyafet: '#2E8E7E' }, mentor: ODY,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Altı aydır ara ara dünya dönüyor, kusacak gibi oluyorum. O zamanlar sağ kulağım da tıkanıyor.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'baş dönmesini tanımlayan soruları seç', secenek: [
          S('sure', 'Bir atak ne kadar sürüyor?', '20 dakikadan birkaç saate kadar sürüyor.', 3, 'Atak süresi|20 dk – birkaç saat.'),
          S('kulak', 'Atak sırasında kulağınızda ne oluyor?', 'Sağ kulağım doluyor, uğulduyor, işitmem azalıyor. Atak geçince düzeliyor gibi.', 3, 'Kulak|Dolgunluk, uğultu, dalgalanan işitme.'),
          S('pozisyon', 'Başınızı çevirince ya da yatarken mi başlıyor?', 'Hayır, oturup dururken de geliyor.', 2, 'Tetik|Pozisyonla ilgisiz.'),
          S('sikilik', 'Ne sıklıkla oluyor?', 'Ayda iki üç kez.', 1, 'Sıklık|Ayda 2–3.'),
          S('kafein', 'Kahve içiyor musunuz?', 'Sabahları bir fincan.', 0),
          YARGI('hasta', 'Belki de kaygıdandır, bu kadar büyütmeyin?', 'Ama gerçekten dönüyor…')
        ] },
        { tip: 'eylem', baslik: 'Kulak muayenesi', yonerge: 'gerekenleri yap', secenek: [
          E('otoskopi', 'Otoskopla iki kulağa bak', 'Doğal.', 3),
          E('weber', 'Weber testi', 'Sesi sol kulağında duyuyor.', 2, { geri: 'Weber sağlam tarafa kayıyor: sağda sensörinöral kayıp.' }),
          E('rinne', 'Rinne testi', 'İki kulakta Rinne pozitif.', 2),
          E('dix', 'Atak yokken hızlı Dix-Hallpike manevrası yap', 'Nistagmus yok; manevra hastayı bulandırdı.', 0, { geri: 'Pozisyonla ilgisiz ataklarda bu manevra tanıya katkı sağlamaz.' })
        ] },
        K('İşitmesi atakla dalgalanıyor. Ölçümü nasıl planlarsın?', [
          ['Saf ses ve konuşma odyometrisi ile timpanometri; ölçüm tarihini ve atakla ilişkisini kaydet, atak günlüğü iste', true, 'Doğru. Alçak frekanslarda dalgalanan kayıp tipiktir; tek ölçüm yerine seri ölçüm ve atak günlüğü tabloyu gösterir.'],
          ['Yalnızca baş dönmesi testleri yeterli, işitme ölçülmez', false, 'İşitmedeki dalgalanma tanının parçasıdır; ölçülmeden değerlendirme eksik kalır.'],
          ['Ölçümü atak sırasında, kusarken yap', false, 'Atak sırasında hasta güvenilir yanıt veremez; ölçüm stabil dönemde yapılır, değişim kaydedilir.']
        ]),
        MASA('Vaka masasında testleri iste, refleksi kabinde ölç; tanı ve yönlendirmeyi yaz.')
      ] },

    /* ------------------------------ Retrokoklear ------------------------------ */
    { id: 'ody-v-noroma', vaka: 'v-noroma', lab: 'odyoloji', oda: 'odyo', odaAd: 'Odyoloji polikliniği', baslik: '30 yaşında erkek: tek taraflı ilerleyen kayıp',
      hasta: { ad: 'Onur Bey', hitap: 'Onur Bey', yas: 30, cins: 'E', gorunum: 'genc', kiyafet: '#3E6E9E' }, mentor: ODY,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Sağ kulağım bir yıldır gittikçe kötü duyuyor. Telefonu hep sol kulağıma tutuyorum.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('seyir', 'Birden mi başladı, yavaş mı ilerledi?', 'Yavaş yavaş, bir yıldır artıyor.', 3, 'Seyir|1 yıl, yavaş ilerleyen.'),
          S('cinlama', 'Aynı kulakta çınlama var mı?', 'Evet, sağda sürekli bir çınlama var.', 2, 'Eşlik|Sağda çınlama.'),
          S('denge', 'Denge sorunu yaşıyor musunuz?', 'Ara ara dengesiz hissediyorum.', 3, 'Denge|Ara ara dengesizlik.'),
          S('anlama', 'Sağ kulakla konuşmaları anlayabiliyor musunuz?', 'Sesi duyuyorum ama sözcükleri seçemiyorum.', 3, 'Anlama|Sağda ayırt etme zayıf.'),
          S('kulaklik', 'Kulaklıkla müzik dinler misiniz?', 'Bazen, çok yüksek değil.', 0),
          YARGI('hasta', 'Hep telefona bakmaktan olmasın?', 'Bilmiyorum, öyle bir şey olur mu?', 'Dayanaksız yorum yanlış güven verir; tek taraflı kayıp mutlaka araştırılır.')
        ] },
        { tip: 'eylem', baslik: 'Kulak muayenesi', yonerge: 'gerekenleri yap', secenek: [
          E('otoskopi', 'Otoskopla iki kulağa bak', 'Doğal.', 3),
          E('weber', 'Weber testi', 'Sesi sol kulağında duyuyor.', 3, { geri: 'Sağda sensörinöral kayıp düşündürür.' }),
          E('rinne', 'Rinne testi', 'İki kulakta Rinne pozitif.', 1),
          E('cihaz', 'Hemen sağ kulağa işitme cihazı dene', 'Mentor seni durduruyor.', -2, { geri: 'Asimetrik kayıpta neden araştırılmadan cihaza geçilmez.' })
        ] },
        K('Tek taraflı, ilerleyen ve anlaması zayıf bir kayıp. Ölçüm planın ne?', [
          ['Saf ses ve konuşma odyometrisi, akustik refleks (kayma dahil) ve ABR; asimetri nedeni mutlaka araştırılır', true, 'Doğru. Asimetrik sensörinöral kayıp her zaman ileri inceleme ister; konuşma, refleks ve ABR bulguları birlikte değerlendirilir.'],
          ['Yalnızca saf ses odyometrisi yeterli', false, 'Eşiğe göre orantısız düşük konuşma skoru ve refleks bulguları gözden kaçar.'],
          ['Yıllık kontrol yeterli', false, 'İlerleyen tek taraflı kayıp beklemeye bırakılmaz.']
        ]),
        MASA('Vaka masasında testleri iste, refleksi kabinde ölç; bulguları birleştirip tanı ve yönlendirmeyi yaz.')
      ] },

    /* ------------------------------ İşitsel nöropati (yenidoğan) ------------------------------ */
    { id: 'ody-v-ansd', vaka: 'v-ansd', lab: 'odyoloji', oda: 'acil', odaAd: 'Yenidoğan servisi', baslik: '2 günlük bebek: yenidoğan taraması',
      hasta: { ad: 'Bebek Deniz', hitap: 'bebek', yas: '2 günlük', cins: 'K', gorunum: 'cocuk', poz: 'yat', konusamaz: true, sac: '#5A3A22', kiyafet: '#F2D0DC' }, refakat: { ad: 'Annesi', cins: 'K', gorunum: 'yetiskin', kiyafet: '#7A4FA8' }, mentor: ODY,
      adimlar: [
        { tip: 'konus', kim: 'anlatici', metin: 'Yenidoğan yoğun bakımdan çıkan bebek, taburcu olmadan işitme taramasına getirildi.' },
        { tip: 'konus', kim: 'refakat', metin: 'Yoğun bakımda kaldı, sarılığı çok yükselmişti. Kulakları da etkilenmiş olabilir mi?' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'risk etkenlerini yakala', secenek: [
          S('ybu', 'Yoğun bakımda kaç gün kaldı?', 'Yedi gün kaldı.', 3, 'Yoğun bakım|7 gün.', 'refakat'),
          S('sarilik', 'Sarılığı için ne tedavi uygulandı?', 'Işık tedavisi yetmedi, kan değişimi yapıldı.', 3, 'Hiperbilirubinemi|Kan değişimi gerektirmiş.', 'refakat'),
          S('aile', 'Ailede çocuklukta başlayan işitme kaybı var mı?', 'Bildiğimiz kimse yok.', 2, 'Aile|Yok.', 'refakat'),
          S('dogum', 'Doğum haftası ve ağırlığı?', '38 haftada, 3200 gramdı.', 1, 'Doğum|38 hafta, 3200 g.', 'refakat'),
          S('emzirme', 'Emzirebiliyor musunuz?', 'Evet, iyi emiyor.', 0, null, 'refakat'),
          YARGI('refakat', 'Gebelikte bir şey mi yaptınız da böyle oldu?', 'Hayır… ben elimden geleni yaptım.', 'Annede suçluluk uyandırmak bilgi getirmez; yenidoğan sarılığı annenin hatası değildir.')
        ] },
        { tip: 'eylem', baslik: 'Hazırlık', yonerge: 'test öncesi gerekenleri yap', secenek: [
          E('uyku', 'Bebeğin emzirildikten sonra uyumasını bekle', 'Deniz uyudu; sakin ortam ölçüm için uygun.', 2, { geri: 'Fizyolojik testlerde uyuyan ve sakin bebek gürültüyü azaltır.' }),
          E('otoskopi', 'Kulak yollarına otoskopla bak', 'Kulak yolları açık, zarlar seçiliyor.', 3),
          E('davranis', 'Ellerini çırparak tepkisine bak', 'Bebek irkildi ama bu tepki işitmenin derecesini göstermez.', 0, { geri: 'Davranışsal gözlem yenidoğanda tarama yerine geçmez.' }),
          E('uyandir', 'Testi hızlandırmak için bebeği uyandır', 'Deniz ağlamaya başladı; kayıt gürültülü.', -1)
        ] },
        K('Yoğun bakımda yatmış ve kan değişimi yapılmış bu bebekte tarama nasıl yapılmalı?', [
          ['Otomatik ABR mutlaka yapılmalı; yalnız OAE ile tarama yeterli değildir', true, 'Doğru. Yoğun bakım bebeklerinde sinirsel iletim sorunları (işitsel nöropati) OAE ile yakalanamaz; ABR şarttır.'],
          ['OAE geçerse tarama tamamdır', false, 'OAE yalnız dış tüy hücrelerini gösterir; sinirsel iletim bozuksa OAE geçebilir.'],
          ['Altı ay sonra davranışsal test yapılsın', false, 'Yenidoğan taraması taburculuk öncesi yapılır; geciktirmek erken müdahaleyi kaçırır.']
        ]),
        MASA('Vaka masasında hangi testleri isteyeceğini seç ve sonuçları yorumla; tanı ve yönlendirmeyi yaz.')
      ] },

    /* ------------------------------ Kronik otitis media ------------------------------ */
    { id: 'ody-v-kom', vaka: 'v-kom', lab: 'odyoloji', oda: 'odyo', odaAd: 'Odyoloji polikliniği', baslik: '60 yaşında erkek: akıntılı sol kulak',
      hasta: { ad: 'Halil Bey', hitap: 'Halil Bey', yas: 60, cins: 'E', gorunum: 'yasli', kiyafet: '#6B5B45' }, mentor: ODY,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Sol kulağım çocukluğumdan beri ara ara akar. Yıllar geçtikçe o kulakla duymaz oldum.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('akinti', 'Akıntı nasıl, kokusu var mı, son ne zaman aktı?', 'Kokusu yok. Banyodan sonra ya da nezle olunca akıyor, son ay da aktı.', 3, 'Akıntı|Kokusuz, tekrarlayan; son ay aktif.'),
          S('seyir', 'İşitme kaybı ne zamandır var, artıyor mu?', 'Yıllardır var, gittikçe arttı.', 3, 'Seyir|Yıllar içinde artan.'),
          S('denge', 'Baş dönmesi, yüzde güçsüzlük ya da şiddetli baş ağrısı oldu mu?', 'Hayır, hiç olmadı.', 3, 'Komplikasyon|Vertigo, fasiyal güçsüzlük, baş ağrısı yok.'),
          S('sag', 'Sağ kulağınız nasıl duyuyor?', 'Sağ iyi.', 1, 'Karşı kulak|İyi.'),
          S('cay', 'Günde kaç bardak çay içersiniz?', 'Beş altı bardak.', 0),
          YARGI('hasta', 'Bu kadar yıl neden tedavi olmadınız?', 'Akıp duruyordu, alıştım.')
        ] },
        { tip: 'eylem', baslik: 'Kulak muayenesi', yonerge: 'gerekenleri yap', secenek: [
          E('otoskopi', 'Otoskopla iki kulağa bak', 'Sol kulak zarında geniş santral perforasyon, orta kulak mukozası nemli. Sağ kulak doğal.', 3),
          E('weber', 'Weber testi', 'Sesi sol kulağında duyuyor.', 2, { geri: 'İletim tipi kayıpta Weber kötü kulağa kayar.' }),
          E('rinne', 'Rinne testi', 'Solda kemik yolu hava yolundan uzun (Rinne negatif); sağda pozitif.', 2),
          E('lavaj', 'Kulak yolunu su ile yıka', 'Mentor seni hemen durduruyor.', -3, { geri: 'Perforasyonlu kulağa su verilmez; orta kulak enfeksiyonu alevlenebilir. Kulak kuru tutulur.' })
        ] },
        K('Perforasyonlu ve nemli kulakta ölçümü nasıl planlarsın?', [
          ['Otoskopiyle başla; hava ve kemik yolu odyometrisi (maskeleme ile), timpanometride kulak yolu hacmine dikkat; problar temiz ve hijyenik', true, 'Doğru. Perforasyonda timpanogram düz çıkar ama kulak yolu hacmi yüksektir; kemik yolu iç kulağın da etkilenip etkilenmediğini gösterir.'],
          ['Akıntılı kulakta hiçbir ölçüm yapılmaz', false, 'Hijyen kurallarına uyularak ölçüm yapılabilir; tedavi planı için kaybın tipi gerekir.'],
          ['Yalnızca sağ kulak ölçülür', false, 'Yakınma sol kulakta; iki kulak da ölçülmelidir.']
        ]),
        MASA('Vaka masasında testleri iste, timpanometriyi kabinde ölç; tanı ve yönlendirmeyi yaz.')
      ] },

    /* ============ 31.10.2026: Acadex Medica yeni hastaları (Kerem → DKT, Nurten Hanım → Diyet konsültasyonu) ============ */
    /* ------------------------------ Konuşma gecikmesi olan çocuk ------------------------------ */
    { id: 'ody-v-kerem', vaka: 'v-kerem', lab: 'odyoloji', oda: 'odyo', odaAd: 'Çocuk odyolojisi', baslik: '4 yaşında çocuk: "hâlâ cümle kurmuyor"',
      hasta: { ad: 'Kerem', hitap: 'Kerem', yas: 4, cins: 'E', gorunum: 'cocuk', sac: '#2E241C', kiyafet: '#E0A526' }, refakat: { ad: 'Annesi Seda Hanım', cins: 'K', gorunum: 'yetiskin', kiyafet: '#6A4FA8', ifade: 'endise' }, mentor: ODY,
      adimlar: [
        { tip: 'konus', kim: 'refakat', metin: 'Kerem dört yaşında ama on, on beş kelime söylüyor. Arkadan seslenince bazen dönüyor, bazen hiç dönmüyor.' },
        { tip: 'konus', kim: 'mentor', metin: 'Konuşma gecikmesinde ilk soru işitmedir. Doğumdan bugüne öyküyü topla; üç soru hakkın var.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'işitme kaybı risklerini aydınlatan soruları seç', secenek: [
          S('tarama', 'Yenidoğan işitme taramasının sonucu neydi?', '“Tekrar edilsin” dediler, sonra pandemi oldu, gidemedik.', 3, 'Tarama|Yenidoğan taraması geçilemedi, kontrol yapılmamış.', 'refakat'),
          S('gebelik', 'Gebelikte geçirdiğiniz bir hastalık oldu mu?', 'Üçüncü ayda ateşli bir hastalık geçirdim, ne olduğunu bilmiyoruz.', 3, 'Gebelik|1. trimesterde ateşli hastalık (konjenital enfeksiyon?).', 'refakat'),
          S('tepki', 'Hangi seslere tepki veriyor, hangilerine vermiyor?', 'Kapı zili, köpek havlaması duyuyor gibi; fısıltıya hiç dönmüyor.', 2, 'Davranış|Yüksek seslere yanıt var, kısık sese yok.', 'refakat'),
          S('kulak', 'Sık kulak iltihabı geçirdi mi?', 'Hayır, hiç kulak ağrısı olmadı.', 2, 'Orta kulak|Sık otit öyküsü yok.', 'refakat'),
          S('kres', 'Kreşe gidiyor mu?', 'Henüz değil.', 0, null, 'refakat'),
          YARGI('refakat', 'Kontrole neden götürmediniz?', 'Biz de çok pişmanız…', 'Geçmişi suçlamak yerine bugünden sonraki planı birlikte kurmak güven yaratır.')
        ] },
        { tip: 'eylem', baslik: 'Kulak muayenesi', yonerge: 'gerekenleri yap', secenek: [
          E('oyun', 'Kerem’le oyun kurarak işbirliğini sağla', 'Kerem kulaklıktan gelen sesi duyunca kovaya top atmayı öğrendi.', 2, { geri: 'Bu yaşta oyun odyometrisi güvenilir eşik almayı sağlar.' }),
          E('otoskopi', 'Otoskopla iki kulağa bak', 'Her iki dış kulak yolu açık, kulak zarları doğal; ışık refleksi seçiliyor.', 3),
          E('fisilti', 'Arkasından fısıltıyla adını söyle', 'Kerem dönmüyor; normal sesle ikinci denemede dönüyor.', 2),
          E('zorla', 'Kıpırdamasın diye kollarını tutup kulaklığı tak', 'Kerem ağlıyor ve kulaklığı fırlatıyor.', -2, { geri: 'Zorlamak işbirliğini bozar ve ölçümü güvenilmez kılar.' })
        ] },
        K('Kulak zarları doğal görünüyor. Bu çocukta ölçüm planı ne olmalı?', [
          ['Yaşa uygun (oyun) saf ses odyometrisi, timpanometri ve OAE; gerekirse eşik ABR ile doğrulama', true, 'Doğru. Normal zar orta kulak sorununu dışlamaz ama azaltır; timpanometri orta kulağı, OAE kokleayı, odyometri kaybın derecesini gösterir.'],
          ['Zar normal olduğuna göre işitme normaldir; doğrudan konuşma terapisine yönlendir', false, 'Normal kulak zarı iç kulak kaybını dışlamaz. Konuşma gecikmesinde önce işitme ölçülür.'],
          ['Yalnızca bir yıl sonra kontrol', false, 'Dil gelişiminin kritik döneminde bekleme kayıp yaratır.']
        ]),
        MASA('Vaka masasında testleri iste; timpanometriyi kabinde ölç, sonra tanı ve yönlendirmeyi yaz. Gerekirse DKT katına konsültasyon iste.')
      ] },

    /* ------------------------------ Tıkanan kulak ------------------------------ */
    { id: 'ody-v-buson', vaka: 'v-buson', lab: 'odyoloji', oda: 'odyo', odaAd: 'Odyoloji polikliniği', baslik: '66 yaşında erkek: duştan sonra sağ kulak tıkandı',
      hasta: { ad: 'Recep Bey', hitap: 'Recep Bey', yas: 66, cins: 'E', gorunum: 'yasli', kiyafet: '#5E8F4A' }, mentor: ODY,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Dün duştan çıktım, sağ kulağım birden tıkandı. Kendi sesim kafamın içinde yankılanıyor.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'acil durumu ayırt eden soruları seç', secenek: [
          S('cubuk', 'Kulaklarınızı nasıl temizliyorsunuz?', 'Her gün pamuklu çubukla, iyice içine kadar.', 3, 'Alışkanlık|Her gün pamuklu çubuk.'),
          S('ani', 'Tıkanmayla birlikte çınlama ya da baş dönmesi oldu mu?', 'Hayır, sadece tıkalı gibi.', 3, 'Eşlik eden|Çınlama ve baş dönmesi yok.'),
          S('agri', 'Ağrı, akıntı ya da ateş var mı?', 'Yok.', 2, 'Enfeksiyon|Ağrı, akıntı, ateş yok.'),
          S('sol', 'Sol kulağınızda sorun var mı?', 'Yok, solla iyi duyuyorum.', 1),
          S('torun', 'Kaç torununuz var?', 'Beş.', 0),
          YARGI('hasta', 'Pamuklu çubuk kullanılmaz, bunu herkes bilir!', 'Bilmiyordum…', 'Azarlamak yerine nedenini açıklamak davranışı değiştirir.')
        ] },
        { tip: 'eylem', baslik: 'Kulak muayenesi', yonerge: 'gerekenleri yap', secenek: [
          E('otoskopi', 'Otoskopla iki kulağa bak', 'Sağ dış kulak yolu sertleşmiş kulak kiriyle (buşon) tamamen tıkalı; kulak zarı görülemiyor. Sol kulak doğal.', 3),
          E('diyapazon', 'Diyapazonla Rinne ve Weber yap', 'Weber sağa (tıkalı kulağa) lateralize; sağda Rinne negatif, solda pozitif.', 2),
          E('prob', 'Timpanometri probunu sağ kulağa yerleştirmeyi dene', 'Prob kulak yolunu kapatamıyor; cihaz hacmi çok düşük gösteriyor.', 1),
          E('kurdan', 'Kulak kirini kendin kürdanla çıkarmayı dene', 'Recep Bey irkiliyor; kulak yolu kanamaya başlıyor.', -3, { ifade: 'agri', geri: 'Tıkacı temizlemek uygun alet ve deneyim ister; odyolog yönlendirir.' })
        ] },
        K('Kulak yolu tamamen tıkalı. Ölçümü nasıl planlarsın?', [
          ['Otoskopi bulgusunu kaydet, iki kulağın hava-kemik yolunu ve timpanometriyi ölç; kulak yolu açıldıktan sonra kontrol ölçümü planla', true, 'Doğru. Şimdiki ölçüm tıkacın etkisini gösterir; kalıcı bir kayıp olup olmadığını temizlik sonrası odyogram söyler.'],
          ['Hemen işitme cihazı kalıbı al', false, 'Tıkalı kulak yolundan kalıp alınmaz; önce neden ortadan kaldırılır.'],
          ['Ölçüme gerek yok, eve gönder', false, 'Kaybın tipi kayıt altına alınmalı ve kulak yolu açıldıktan sonra karşılaştırılmalıdır.']
        ]),
        MASA('Vaka masasında testleri iste, timpanometriyi kabinde ölç; tanı ve yönlendirmeyi yaz.')
      ] },

    /* ------------------------------ Ototoksisite izlemi ------------------------------ */
    { id: 'ody-v-ototoks', vaka: 'v-ototoks', lab: 'odyoloji', oda: 'odyo', odaAd: 'Onkoloji işitme izlemi', baslik: '56 yaşında kadın: kemoterapi sırasında işitme izlemi',
      hasta: { ad: 'Nurten Hanım', hitap: 'Nurten Hanım', yas: 56, cins: 'K', gorunum: 'yetiskin', kiyafet: '#9E5B7A', ifade: 'uzgun' }, mentor: ODY,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Kemoterapinin üçüncü kürünü aldım. Kulaklarımda tiz bir çınlama başladı, kalabalıkta konuşulanları kaçırıyorum.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'izlem için gereken bilgileri topla', secenek: [
          S('ilac', 'Hangi kemoterapi ilacını alıyorsunuz?', 'Sisplatin dediler; üç haftada bir.', 3, 'İlaç|Sisplatin, 3 haftada bir, 3. kür.'),
          S('once', 'Tedaviden önce işitme testi yapılmış mıydı?', 'Evet, başlamadan önce yaptılar, normalmiş.', 3, 'Bazal|Tedavi öncesi odyogram normal.'),
          S('cinlama', 'Çınlama ne zaman başladı, tek mi iki kulakta mı?', 'İkinci kürden sonra, iki kulakta.', 2, 'Belirti|2. kürden sonra iki taraflı çınlama.'),
          S('istah', 'Genel olarak nasılsınız, yemek yiyebiliyor musunuz?', 'İştahım hiç yok, bir ayda dört kilo verdim.', 2, 'Genel|İştahsızlık, 1 ayda 4 kg kayıp.', null, 'İyi soru: işitme dışı bir sorun yakaladın; ekip içi konsültasyon (diyetisyen) gerekebilir.'),
          S('cocuk', 'Çocuklarınız ne iş yapıyor?', 'Biri öğretmen, biri mühendis.', 0),
          YARGI('hasta', 'Bu ilaçları almasanız daha iyi olmaz mı?', 'Ama doktorum gerekli dedi…', 'Tedavi kararı onkoloji ekibinindir; odyolog bulguyu paylaşır, ilacı sorgulatmaz.')
        ] },
        { tip: 'eylem', baslik: 'Kulak muayenesi', yonerge: 'gerekenleri yap', secenek: [
          E('otoskopi', 'Otoskopla iki kulağa bak', 'Her iki dış kulak yolu ve kulak zarı doğal.', 3),
          E('dosya', 'Tedavi öncesi odyogramı dosyadan aç', 'Bazal odyogram iki kulakta 8 kHz’e kadar 20 dB ve daha iyi.', 3),
          E('diyapazon', 'Diyapazonla Rinne ve Weber yap', 'Rinne iki kulakta pozitif, Weber ortada.', 1),
          E('yuksek', 'Konuşmanı anlasın diye bağırarak konuş', 'Nurten Hanım irkiliyor, kulaklarını kapatıyor.', -2, { ifade: 'endise', geri: 'Bağırmak yüksek frekans kaybında anlaşılırlığı artırmaz; yüzünü görerek, net ve yavaş konuş.' })
        ] },
        K('İzlem planı ne olmalı?', [
          ['Saf ses odyometrisini 8 kHz’e kadar ölç, OAE ile bazal kayıtla karşılaştır; bulguyu onkoloji ekibiyle paylaş', true, 'Doğru. Bu tablo yüksek frekanslardan başladığı için izlemde yüksek frekanslar ve OAE duyarlıdır; karşılaştırma bazal kayıtla yapılır.'],
          ['Yalnızca 500–2000 Hz ölç, ortalama normalse sorun yok', false, 'Konuşma frekanslarının ortalaması ilk değişiklikleri gizleyebilir.'],
          ['Hastaya ilacı bırakmasını öner', false, 'İlaç kararı onkoloji ekibinindir.']
        ]),
        MASA('Vaka masasında testleri iste; timpanometriyi kabinde ölç, sonra tanı ve yönlendirmeyi yaz. Kilo kaybı için Diyet katına konsültasyon gerekebilir.')
      ] },

    /* ------------------------------ Travmatik perforasyon ------------------------------ */
    { id: 'ody-v-perfor', vaka: 'v-perfor', lab: 'odyoloji', oda: 'odyo', odaAd: 'Odyoloji polikliniği', baslik: '27 yaşında kadın: kulak temizlerken keskin ağrı',
      hasta: { ad: 'Burcu Hanım', hitap: 'Burcu Hanım', yas: 27, cins: 'K', gorunum: 'genc', kiyafet: '#2F6BFF', ifade: 'agri' }, mentor: ODY,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Dün kulağımı pamuklu çubukla temizlerken kolum çarpıldı. Keskin bir ağrı, birkaç damla kan… şimdi sol kulağım tıkalı.' },
        { tip: 'sor', baslik: 'Anamnez', hak: 3, yonerge: 'iç kulak yaralanmasını ayırt eden soruları seç', secenek: [
          S('donme', 'Baş dönmesi, bulantı ya da kusma oldu mu?', 'Hayır, hiç olmadı.', 3, 'Vestibüler|Baş dönmesi, bulantı yok.'),
          S('cinlama', 'Çınlama ya da sesleri bozuk duyma var mı?', 'Hafif uğultu var, o kadar.', 3, 'İşitsel|Hafif uğultu.'),
          S('yuz', 'Yüzünüzde güçsüzlük, gözünüzü kapatmada zorluk var mı?', 'Hayır.', 2, 'Fasiyal|Yüz siniri işlevi normal.'),
          S('su', 'Kulağınıza su kaçtı mı?', 'Duş alırken biraz girmiş olabilir.', 2, 'Enfeksiyon riski|Kulağa su teması.'),
          S('is', 'Ne iş yapıyorsunuz?', 'Muhasebeci.', 0),
          YARGI('hasta', 'Bu kadar dikkatsiz olmasaydınız…', 'Kaza oldu işte…', 'Yaralanmadan sonra yargı değil, güvence ve doğru bilgi gerekir.')
        ] },
        { tip: 'eylem', baslik: 'Kulak muayenesi', yonerge: 'gerekenleri yap', secenek: [
          E('otoskopi', 'Otoskopla iki kulağa bak', 'Sol kulak zarının arka-alt kadranında küçük, kenarları düzensiz taze perforasyon; kurumuş kan izi var. Sağ kulak doğal.', 3),
          E('diyapazon', 'Diyapazonla Rinne ve Weber yap', 'Weber sola (yaralı kulağa) lateralize; solda Rinne negatif, sağda pozitif.', 3),
          E('nistagmus', 'Spontan nistagmusa bak', 'Nistagmus yok.', 1),
          E('yika', 'Kanı temizlemek için kulağı suyla yıka', 'Burcu Hanım baş dönmesinden yakınıyor; perforasyondan orta kulağa su kaçtı.', -3, { ifade: 'agri', geri: 'Perforasyonda kulak yıkanmaz; kulak kuru tutulur.' })
        ] },
        K('Ölçüm planı ne olmalı?', [
          ['Hava ve kemik yolu odyometrisi (kemik yolunun korunup korunmadığı kritik) ve timpanometri; kulağı kuru tutma önerisi', true, 'Doğru. Kemik yolu normal ve Weber yaralı kulağa gidiyorsa kayıp orta kulak düzeyindedir; kemik yolunda kayıp iç kulak yaralanmasını düşündürür ve acildir.'],
          ['Yalnızca hava yolu ölçümü yeterli', false, 'Kemik yolu ölçülmeden iç kulak yaralanması dışlanamaz.'],
          ['Hiç ölçmeden kendiliğinden geçer de', false, 'Kaybın tipi ve iç kulak durumu kayıt altına alınmalıdır.']
        ]),
        MASA('Vaka masasında testleri iste, timpanometriyi kabinde ölç; tanı ve yönlendirmeyi yaz.')
      ] }
  ];
});
