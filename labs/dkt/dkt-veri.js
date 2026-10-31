/* ==========================================================================
   ACADEX DKT LAB · içerik verisi (labs/dkt/dkt-veri.js), 29.10.2026
   Dil ve Konuşma Terapisi öğrencileri için: sesletim, ses, akıcılık, yutma,
   dil gelişimi / afazi ve klinik vaka masası. Eğitim amaçlıdır, tanı koymaz.
   Kaynaklar (genel ders kitabı bilgisi): Türkçe ünsüz sınıflaması (yer, biçim,
   ötümlülük); s/z oranı (Eckel ve Boone, 1981); GRBAS (Hirano, 1981);
   Penetrasyon-Aspirasyon Skalası (Rosenbek ve ark., 1996); IDDSI çerçevesi
   (iddsi.org, CC BY-SA 4.0); afazi sınıflaması (Boston sınıflaması).
   Vakalar ve konuşma örnekleri kurgusaldır.
   ========================================================================== */
(function () {
  'use strict';
  var V = window.AXDKT = {};

  /* ---------------- SESLETİM: Türkçe ünsüzler ----------------
     yer: dudak · dudakdis · dis (diş-dişeti) · damakdis (damak-dişeti) · damak (sert damak) · artdamak (yumuşak damak) · girtlak
     bicim: patlamali · surtunmeli · yaripat (yarı patlamalı / affrikat) · genizsil · yanal · titrek · yariunlu */
  V.YER = [
    ['dudak', 'Dudak', 'iki dudak'],
    ['dudakdis', 'Dudak-diş', 'alt dudak + üst dişler'],
    ['dis', 'Diş-dişeti', 'dil ucu + dişeti sırtı'],
    ['damakdis', 'Damak-dişeti', 'dil ucu/ön + dişeti arkası'],
    ['damak', 'Sert damak', 'dil önü + sert damak'],
    ['artdamak', 'Yumuşak damak', 'dil arkası + yumuşak damak'],
    ['girtlak', 'Gırtlak', 'ses telleri arası']
  ];
  V.BICIM = [
    ['patlamali', 'Patlamalı (durak)', 'hava tamamen kapanır, sonra patlar'],
    ['surtunmeli', 'Sürtünmeli (sızıcı)', 'dar aralıktan hava sürtünerek geçer'],
    ['yaripat', 'Yarı patlamalı', 'kapanma + sürtünmeyle açılma'],
    ['genizsil', 'Genizsil (nazal)', 'yumuşak damak iner, hava burundan çıkar'],
    ['yanal', 'Yanal', 'hava dilin yanlarından akar'],
    ['titrek', 'Titrek / çarpmalı', 'dil ucu dişetine bir ya da birkaç kez vurur'],
    ['yariunlu', 'Yarı ünlü (kayıcı)', 'daralma sürtünme yaratmayacak kadar geniş']
  ];
  /* h: harf · ipa · yer · bicim · ot (ötümlü) · ornek · cift (ötümlü/ötümsüz eşi) · not */
  V.UNSUZ = [
    { h: 'p', ipa: 'p', yer: 'dudak', bicim: 'patlamali', ot: false, ornek: 'pul, kapı, top', cift: 'b' },
    { h: 'b', ipa: 'b', yer: 'dudak', bicim: 'patlamali', ot: true, ornek: 'bal, abla', cift: 'p', not: 'Türkçede sözcük sonunda ötümsüzleşir: kitab → kitap.' },
    { h: 'm', ipa: 'm', yer: 'dudak', bicim: 'genizsil', ot: true, ornek: 'mal, ama, dam' },
    { h: 'f', ipa: 'f', yer: 'dudakdis', bicim: 'surtunmeli', ot: false, ornek: 'fil, kafa', cift: 'v' },
    { h: 'v', ipa: 'v', yer: 'dudakdis', bicim: 'surtunmeli', ot: true, ornek: 'var, ova', cift: 'f', not: 'Ünlüler arasında çoğu konuşurda sürtünmesi zayıf, yarı ünlüye yakın [ʋ] olarak söylenir.' },
    { h: 't', ipa: 't', yer: 'dis', bicim: 'patlamali', ot: false, ornek: 'tas, ata, at', cift: 'd' },
    { h: 'd', ipa: 'd', yer: 'dis', bicim: 'patlamali', ot: true, ornek: 'dal, ada', cift: 't' },
    { h: 's', ipa: 's', yer: 'dis', bicim: 'surtunmeli', ot: false, ornek: 'su, ası, as', cift: 'z' },
    { h: 'z', ipa: 'z', yer: 'dis', bicim: 'surtunmeli', ot: true, ornek: 'zar, azı, az', cift: 's' },
    { h: 'n', ipa: 'n', yer: 'dis', bicim: 'genizsil', ot: true, ornek: 'nal, ana, an' },
    { h: 'l', ipa: 'l', yer: 'dis', bicim: 'yanal', ot: true, ornek: 'lale, ala, al', not: 'İnce ünlülerle damaksıl [l], kalın ünlülerle kalın (velarize) [ɫ] söylenir: lale / bal.' },
    { h: 'r', ipa: 'ɾ', yer: 'dis', bicim: 'titrek', ot: true, ornek: 'ara, kar', not: 'Ünlüler arasında tek vuruşlu çarpmalı [ɾ]; sözcük sonunda çoğunlukla sürtünmeli ve ötümsüzleşmiş söylenir.' },
    { h: 'ş', ipa: 'ʃ', yer: 'damakdis', bicim: 'surtunmeli', ot: false, ornek: 'şal, aşı, taş', cift: 'j' },
    { h: 'j', ipa: 'ʒ', yer: 'damakdis', bicim: 'surtunmeli', ot: true, ornek: 'jale, garaj', cift: 'ş', not: 'Çoğunlukla alıntı sözcüklerde geçer.' },
    { h: 'ç', ipa: 'tʃ', yer: 'damakdis', bicim: 'yaripat', ot: false, ornek: 'çam, açı, aç', cift: 'c' },
    { h: 'c', ipa: 'dʒ', yer: 'damakdis', bicim: 'yaripat', ot: true, ornek: 'cam, acı', cift: 'ç' },
    { h: 'y', ipa: 'j', yer: 'damak', bicim: 'yariunlu', ot: true, ornek: 'yol, aya, ay' },
    { h: 'k', ipa: 'k', yer: 'artdamak', bicim: 'patlamali', ot: false, ornek: 'kal, akı, ak', cift: 'g', not: 'İnce ünlülerle öne kayar, sert damakta üretilir [c]: kedi / kale.' },
    { h: 'g', ipa: 'ɡ', yer: 'artdamak', bicim: 'patlamali', ot: true, ornek: 'gol, gaga', cift: 'k', not: 'İnce ünlülerle öne kayar [ɟ]: gel / gol.' },
    { h: 'h', ipa: 'h', yer: 'girtlak', bicim: 'surtunmeli', ot: false, ornek: 'hal, aha, ah', not: 'Ses telleri arasında sürtünme; ağızda belirgin bir daralma yoktur.' }
  ];
  /* ğ ayrı bir ünsüz sesbirim olarak alınmadı: önceki ünlüyü uzatır ya da ünlüler arasında kayma yaratır (dağ [daː], değer [dejer]). */
  V.MINIMAL = [
    ['p', 'b', 'pul', 'bul'], ['t', 'd', 'tal', 'dal'], ['k', 'g', 'kel', 'gel'], ['f', 'v', 'far', 'var'],
    ['s', 'z', 'sar', 'zar'], ['ç', 'c', 'çam', 'cam'], ['m', 'n', 'mal', 'nal'], ['l', 'r', 'kal', 'kar'],
    ['s', 'ş', 'sal', 'şal'], ['t', 'k', 'tel', 'kel']
  ];

  /* fonolojik süreçler (çocuk konuşmasında sık görülen örüntüler) */
  V.SUREC = [
    ['one', 'Öne alma', 'Arka damak sesleri (k, g) öndeki seslerle (t, d) üretilir.'],
    ['durak', 'Duraklaştırma', 'Sürtünmeli ya da yarı patlamalı ses, patlamalı sesle değiştirilir.'],
    ['sondus', 'Son ünsüz düşmesi', 'Sözcük sonundaki ünsüz söylenmez.'],
    ['hece', 'Zayıf hece düşmesi', 'Vurgusuz bir hece atlanır.'],
    ['kayici', 'Kayıcılaştırma', 'r ya da l yarı ünlüyle (y) değiştirilir.'],
    ['kume', 'Ünsüz kümesi azaltma', 'Yan yana iki ünsüzden biri düşer.'],
    ['uyum', 'Ünsüz uyumu', 'Bir ünsüz sözcükteki başka bir ünsüze benzetilir.'],
    ['arka', 'Arkaya alma', 'Öndeki sesler (t, d) arka damakta (k, g) üretilir.']
  ];
  V.SUREC_SORU = [
    { h: 'kedi', c: 'tedi', s: 'one' },
    { h: 'gel', c: 'del', s: 'one' },
    { h: 'su', c: 'tu', s: 'durak' },
    { h: 'şeker', c: 'teker', s: 'durak' },
    { h: 'çay', c: 'tay', s: 'durak' },
    { h: 'top', c: 'to', s: 'sondus' },
    { h: 'kalem', c: 'kale', s: 'sondus' },
    { h: 'domates', c: 'mates', s: 'hece' },
    { h: 'telefon', c: 'tefon', s: 'hece' },
    { h: 'araba', c: 'ayaba', s: 'kayici' },
    { h: 'tren', c: 'ten', s: 'kume' },
    { h: 'kitap', c: 'titap', s: 'uyum' },
    { h: 'tavuk', c: 'kavuk', s: 'arka' }
  ];

  /* ---------------- SES: normlar ve GRBAS ---------------- */
  V.GRBAS = [
    ['G', 'Grade · genel bozukluk', 'Sesin bütün olarak ne kadar bozuk olduğu.'],
    ['R', 'Roughness · pürüzlülük', 'Düzensiz titreşimden gelen kaba, çatlak ses.'],
    ['B', 'Breathiness · nefeslilik', 'Ses tellerinin tam kapanmamasından gelen hava kaçağı.'],
    ['A', 'Asthenia · güçsüzlük', 'Zayıf, yorgun, gücü düşük ses.'],
    ['S', 'Strain · zorlanma', 'Aşırı kas gerginliğiyle çıkan sıkışık ses.']
  ];
  V.GRBAS_DERECE = ['0 · normal', '1 · hafif', '2 · orta', '3 · ağır'];
  V.F0 = [['Yetişkin erkek', 85, 155], ['Yetişkin kadın', 165, 255], ['Çocuk', 220, 330]];

  /* ---------------- AKICILIK ----------------
     tip: ses (ses/hece tekrarı) · soz (tek heceli sözcük tekrarı) · uzatma · blok  → kekemeliğe özgü (KÖ)
          ara (ara söz / interjeksiyon) · rev (düzeltme) · obek (öbek tekrarı)    → diğer akıcısızlıklar
     t: ekranda görünen · w: hece sayısına giren hedef sözcük(ler) */
  V.TIP = [
    ['ses', 'Ses / hece tekrarı', true, 'b-b-bugün'],
    ['soz', 'Tek heceli sözcük tekrarı', true, 'ben ben ben'],
    ['uzatma', 'Uzatma', true, 'sssabah'],
    ['blok', 'Blok', true, 'sessiz takılma'],
    ['ara', 'Ara söz', false, 'ııı, şey'],
    ['rev', 'Düzeltme', false, 'çorba, yok, …'],
    ['obek', 'Öbek tekrarı', false, 'eve dönerken, eve dönerken']
  ];
  V.ORNEK = [
    {
      id: 'market', t: 'Market dönüşü', kim: 'Kurgusal örnek · 9 yaş, okul anlatısı',
      toks: [
        ['Ben'], ['d-d-dün', 'ses', 'dün'], ['akşam'], ['annemle'], ['ııı', 'ara', ''], ['markete'], ['gittik.'],
        ['Orada'], ['şşşşeker', 'uzatma', 'şeker'], ['ve'], ['ekmek'], ['aldık.'],
        ['Sonra'], ['ben, ben, ben', 'soz', 'ben'], ['kasaya'], ['gittim.'],
        ['Kasadaki'], ['abla'], ['bana'], ['‖ para', 'blok', 'para'], ['üstünü'], ['verdi.'],
        ['Eve dönerken, eve dönerken', 'obek', 'eve dönerken'], ['yağmur'], ['başladı.'],
        ['Ka-ka-ka-kardeşim', 'ses', 'kardeşim'], ['çok'], ['korktu'], ['ama'], ['sonra'], ['güldü.'],
        ['Ben'], ['de'], ['şey', 'ara', ''], ['şemsiyemi'], ['açtım.'],
        ['Evde'], ['annem'], ['çorba, yok,', 'rev', ''], ['mercimek'], ['çorbası'], ['yaptı'], ['ve'], ['hepimiz'], ['birlikte'], ['‖ yedik.', 'blok', 'yedik.']
      ]
    },
    {
      id: 'is', t: 'İş görüşmesi provası', kim: 'Kurgusal örnek · 24 yaş, kendini tanıtma',
      toks: [
        ['Merhaba,'], ['benim'], ['adım'], ['Mmmmert.', 'uzatma', 'Mert.'], ['Üniversiteyi'], ['geçen'], ['yıl'], ['bitirdim.'],
        ['Ş-ş-şu', 'ses', 'şu'], ['anda'], ['bir'], ['yazılım'], ['şirketinde'], ['ııı', 'ara', ''], ['stajyer'], ['olarak'], ['çalışıyorum.'],
        ['En'], ['çok'], ['‖ veri', 'blok', 'veri'], ['analizi'], ['ile'], ['ilgileniyorum.'],
        ['Bu'], ['bu', 'soz', ''], ['pozisyon'], ['için'], ['çok'], ['heyecanlıyım,'], ['yani'], ['gerçekten,', 'rev', ''], ['çok'], ['istekliyim.'],
        ['Ta-ta-takım', 'ses', 'takım'], ['çalışmasını'], ['seviyorum'], ['ve'], ['yeni'], ['şeyler'], ['öğrenmek'], ['istiyorum.']
      ]
    }
  ];

  /* ---------------- YUTMA ---------------- */
  V.EVRE = [
    { k: 'hazirlik', t: 'Oral hazırlık', s: 'istemli', d: 'Lokma çiğnenir, tükürükle karışıp yumuşak bir bolus olur. Dudaklar kapalı kalır, dil bolusu toplar.', b: 'Dudakta kaçırma, ağızda kalıntı, uzun çiğneme süresi.' },
    { k: 'oral', t: 'Oral (iletim)', s: 'istemli · ~1 sn', d: 'Dil ucu dişetine dayanır, dil arkadan öne dalga gibi bolusu yutağa iter. Yumuşak damak kalkar.', b: 'Bolusun erken kaçması, geç tetiklenme, burundan geri gelme.' },
    { k: 'faringeal', t: 'Faringeal', s: 'refleks · ~1 sn', d: 'Yumuşak damak burun yolunu kapatır, gırtlak yukarı ve öne kalkar, epiglot devrilir, ses telleri kapanır, solunum durur, üst özofagus sfinkteri açılır.', b: 'Öksürük, boğulma hissi, yaş/gurultulu ses, sessiz aspirasyon.' },
    { k: 'ozofageal', t: 'Özofageal', s: 'istemsiz · 8–20 sn', d: 'Peristaltik dalga bolusu yemek borusundan mideye taşır; alt özofagus sfinkteri açılır.', b: 'Göğüste takılma hissi, geri gelme (reflü). Çoğunlukla gastroenteroloji alanıdır.' }
  ];
  /* Penetrasyon-Aspirasyon Skalası (Rosenbek ve ark., 1996) */
  V.PAS = [
    [1, 'Madde hava yoluna girmez.'],
    [2, 'Madde hava yoluna girer, ses tellerinin üstünde kalır ve hava yolundan atılır.'],
    [3, 'Madde hava yoluna girer, ses tellerinin üstünde kalır ve atılmaz.'],
    [4, 'Madde ses tellerine temas eder ve hava yolundan atılır.'],
    [5, 'Madde ses tellerine temas eder ve atılmaz.'],
    [6, 'Madde ses tellerinin altına geçer ve gırtlağa ya da hava yolu dışına atılır.'],
    [7, 'Madde ses tellerinin altına geçer ve çabaya rağmen trakeadan atılmaz.'],
    [8, 'Madde ses tellerinin altına geçer ve atmak için hiçbir çaba gösterilmez (sessiz aspirasyon).']
  ];
  /* IDDSI (International Dysphagia Diet Standardisation Initiative) */
  V.IDDSI = [
    { n: 0, ad: 'İnce', tur: 'içecek', c: '#FFFFFF', d: 'Su gibi akar; her türlü bardak ve pipetten içilebilir.', test: '10 mL şırınga, 10 sn akış: 1 mL\'den az kalır.' },
    { n: 1, ad: 'Çok hafif koyu', tur: 'içecek', c: '#9C9CA0', d: 'Sudan koyu ama pipetten ve bardaktan akar.', test: '10 sn sonra şırıngada 1–4 mL kalır.' },
    { n: 2, ad: 'Hafif koyu', tur: 'içecek', c: '#F4A6C3', d: 'Kaşıktan hızla akar; pipetle içmek çaba ister.', test: '10 sn sonra 4–8 mL kalır.' },
    { n: 3, ad: 'Orta koyu / akışkan', tur: 'içecek · besin', c: '#F6D04D', d: 'Bardaktan içilebilir, kaşıkla yenebilir; çiğneme gerektirmez.', test: '10 sn sonra 8 mL\'den fazla kalır, yine de akar; çatal dişleri arasından yavaşça damlar.' },
    { n: 4, ad: 'Aşırı koyu / püre', tur: 'içecek · besin', c: '#7FC77A', d: 'Kaşıkla yenir, bardaktan içilemez; şeklini korur, yapışkan değildir.', test: 'Şırıngadan akmaz. Kaşık eğilince tek seferde kayıp düşer; çatalda şeklini korur.' },
    { n: 5, ad: 'Kıyılmış ve nemli', tur: 'besin', c: '#F28C3B', d: 'Yumuşak, nemli, ince kıyılmış; dille ezilebilir.', test: 'Yetişkinde parçalar ≤ 4 mm, çatal dişleri arasına sığar; çatal bastırınca kolayca ezilir.' },
    { n: 6, ad: 'Yumuşak ve lokma boyutu', tur: 'besin', c: '#2D7DD2', d: 'Yumuşak, nemli; çiğneme gerekir ama ısırma gerekmez.', test: 'Yetişkinde parçalar ≤ 1,5 × 1,5 cm; çatalın yanıyla bastırınca ezilir, başparmak tırnağı beyazlar.' },
    { n: 7, ad: 'Normal', tur: 'besin', c: '#222222', d: 'Günlük yiyecekler; ısırma ve çiğneme becerisi gerekir.', test: 'Test yok; "kolay çiğnenen" alt düzeyi de vardır (7EC).' }
  ];
  /* akış testi için gizemli örnekler: kalan mL (10 sn sonunda); null = şırıngadan hiç akmaz */
  V.SIRINGA = [
    { k: 'A', kalan: 0.3 }, { k: 'B', kalan: 2.6 }, { k: 'C', kalan: 6.1 }, { k: 'D', kalan: 9.4 }, { k: 'E', kalan: null }
  ];

  /* ---------------- DİL GELİŞİMİ ---------------- */
  /* ay · anlama · ifade · uyarı (o yaşta yoksa dikkat) — genel gelişim basamakları, bireysel farklılık büyüktür */
  V.GELISIM = [
    { ay: 2, anl: 'Sese irkilir, sesi tanıdık olana yönelir.', ifd: 'Agulama: ünlü benzeri sesler (ıı, aa).' },
    { ay: 6, anl: 'Adına tepki vermeye başlar; ses tonundaki farkı anlar.', ifd: 'Ses oyunları; 6–10. aylarda kanonik babıldama (ba-ba, da-da).', uy: 'Hiç babıldama yoksa işitme değerlendirilmeli.' },
    { ay: 12, anl: 'Basit yönergeleri jestle birlikte anlar ("gel", "ver").', ifd: 'İlk anlamlı sözcükler; işaret etme ve el sallama.', uy: '12 ayda işaret etme, el sallama gibi jestler yoksa.' },
    { ay: 18, anl: 'Tanıdık nesneleri ve vücut parçalarını gösterir.', ifd: 'Yaklaşık 50 sözcük; ardından sözcük dağarcığında hızlı artış.', uy: '16–18 ayda tek sözcük yoksa.' },
    { ay: 24, anl: 'İki aşamalı basit yönergeleri izler.', ifd: 'İki sözcüklü birleşimler ("anne gel"); ekler belirmeye başlar.', uy: '24 ayda kendiliğinden iki sözcüklü birleşim yoksa.' },
    { ay: 36, anl: '"Ne, nerede, kim" sorularını anlar; renk, büyük-küçük kavramları.', ifd: '3–4 sözcüklü cümleler; yabancılar konuşmasının çoğunu anlar.', uy: 'Yabancılar konuşmasının yarısından azını anlıyorsa.' },
    { ay: 48, anl: '"Neden, nasıl" sorularını anlar; zaman kavramları gelişir.', ifd: 'Karmaşık cümleler, olay anlatma; konuşma büyük ölçüde anlaşılır.', uy: 'Basit bir olayı anlatamıyorsa.' },
    { ay: 60, anl: 'Çok aşamalı yönergeler; hikâyeyi dinleyip soruları cevaplar.', ifd: 'Tutarlı anlatı, bağlaçlı uzun cümleler; çoğu sesi doğru üretir.', uy: 'Okul öncesi dönemde konuşması hâlâ çok anlaşılmazsa.' },
    { ay: 72, anl: 'Mecaz ve espriyi anlamaya başlar; sesbilgisel farkındalık (hece, uyak).', ifd: 'Yetişkine yakın dilbilgisi; okumaya hazırlık becerileri.' }
  ];
  /* OSU (ortalama sözce uzunluğu) örnek sözceler: biçimbirimler tire ile ayrılmış (Türkçe eklemeli dil: biçimbirim sayılır) */
  V.OSU = [
    'anne gel', 'top-u ver', 'ben de iste-r-im', 'kedi uyu-yor', 'baba-m araba-yla gel-di', 'su iç-ecek-im', 'bu ne', 'ayı-cık düş-tü'
  ];

  /* ---------------- AFAZİ (Boston sınıflaması) ---------------- */
  /* akıcı · anlama · tekrar → tür */
  V.AFAZI = [
    { ak: false, an: false, te: false, k: 'global', t: 'Global afazi', l: 'Sol hemisferde geniş perisilviyen alan (çoğunlukla orta serebral arter).', d: 'Bütün dil alanlarında ağır bozulma; çoğunlukla otomatik söz kalıpları.' },
    { ak: false, an: false, te: true, k: 'mikst', t: 'Mikst transkortikal afazi', l: 'Perisilviyen alanı kuşatan sınır bölge (watershed) alanları.', d: 'Kendiliğinden konuşma ve anlama çok kısıtlı, tekrar ve ekolali korunmuş.' },
    { ak: false, an: true, te: false, k: 'broca', t: 'Broca afazisi', l: 'Sol alt frontal girus (Broca alanı) ve çevresi.', d: 'Zahmetli, telgraf tarzı konuşma; anlama görece iyi; tekrar bozuk; çoğunlukla sağ hemiparezi.' },
    { ak: false, an: true, te: true, k: 'tkm', t: 'Transkortikal motor afazi', l: 'Broca alanının önü/üstü, ek motor alan.', d: 'Kendiliğinden konuşma başlatmak zor; tekrar şaşırtıcı biçimde iyi.' },
    { ak: true, an: false, te: false, k: 'wernicke', t: 'Wernicke afazisi', l: 'Sol üst temporal girusun arka bölümü (Wernicke alanı).', d: 'Akıcı ama anlamsız/parafazili konuşma; anlama ve tekrar bozuk; hastanın farkındalığı az.' },
    { ak: true, an: false, te: true, k: 'tkd', t: 'Transkortikal duyusal afazi', l: 'Temporo-parieto-oksipital birleşim bölgesi.', d: 'Akıcı, boş konuşma; anlama bozuk; tekrar ve ekolali korunmuş.' },
    { ak: true, an: true, te: false, k: 'iletim', t: 'İletim afazisi', l: 'Arkuat fasikül / supramarjinal girus.', d: 'Akıcı konuşma, fonemik parafaziler; anlama iyi; tekrar belirgin bozuk.' },
    { ak: true, an: true, te: true, k: 'anomik', t: 'Anomik afazi', l: 'Farklı yerlerde olabilir (örn. açısal girus, temporal lob).', d: 'Akıcı konuşma, anlama ve tekrar iyi; belirgin sözcük bulma güçlüğü, dolaylı anlatım.' }
  ];
  V.AFAZI_SORU = [
    { s: '"Ev... ı... hastane... oğlum... araba." Konuşma çok yavaş ve zorlanarak. "Kapıyı kapatın" yönergesini doğru yapıyor. "Bugün hava güzel" cümlesini tekrar edemiyor.', k: 'broca' },
    { s: '"Ben dün şeyde, tarlayı kaptım, o gitmedi zaten, kerdiye güzel oldu." Akıcı ve hızlı konuşuyor. Basit yönergeleri yapamıyor, tekrar da bozuk.', k: 'wernicke' },
    { s: 'Akıcı konuşuyor, anlaması iyi. Resimdeki nesneyi adlandıramıyor: "Şu, yazı yazdığımız şey işte" (kalem). Tekrar iyi.', k: 'anomik' },
    { s: 'Akıcı konuşuyor, anlama iyi. "Telefon" yerine "pelefon" diyor, kendini düzeltmeye uğraşıyor. Cümle tekrarında belirgin zorlanıyor.', k: 'iletim' },
    { s: 'Kendiliğinden hemen hiç konuşmuyor, yönergeleri anlamıyor. Yalnızca "evet evet" diyebiliyor ve sayıları sayabiliyor. Tekrar yapamıyor.', k: 'global' }
  ];

  /* ---------------- KLİNİK VAKA MASASI ----------------
     her vaka: öykü · değerlendirme seçenekleri (ok: gerekli) · bulgular · tanısal izlenim · terapi seçenekleri (ok: uygun) */
  V.VAKA = [
    {
      id: 'ssd', ad: 'Ege', yas: '4 yaş 6 ay', ikon: 'cocuk', renk: '#F4C9A8',
      sikayet: 'Annesi "kedi" yerine "tedi", "gel" yerine "del" dediğini, yabancıların konuşmasını zor anladığını söylüyor.',
      oyku: 'Doğum ve motor gelişim normal. Sık orta kulak iltihabı öyküsü yok. Anaokuluna gidiyor, arkadaşlarıyla oynuyor; dil anlaması yaşına uygun görünüyor.',
      deg: [
        ['sst', 'Sesletim ve sesbilgisi testi (resim adlandırma + konuşma örneği)', true],
        ['isitme', 'İşitme taraması (odyolojiye yönlendirme)', true],
        ['oral', 'Oral-motor yapı ve işlev muayenesi', true],
        ['grbas', 'GRBAS ile ses kalitesi derecelendirmesi', false],
        ['vfss', 'Videofloroskopik yutma çalışması', false],
        ['pct', 'Konuşma örneğinde %TH (kekemelik hece yüzdesi)', false]
      ],
      bulgu: 'İşitme normal. Oral-motor yapı ve işlev normal. Testte k → t ve g → d değişimi tutarlı (sözcük başı ve ortası); diğer sesler yaşa uygun. Tek tek "k" sesini taklitle üretebiliyor.',
      tani: [
        ['fon', 'Konuşma sesi bozukluğu: fonolojik (öne alma süreci)', true],
        ['art', 'Artikülasyon bozukluğu: motor kaynaklı tek ses hatası', false],
        ['cas', 'Çocukluk çağı konuşma apraksisi', false],
        ['dil', 'Gelişimsel dil bozukluğu', false]
      ],
      terapi: [
        ['min', 'Minimal çift terapisi (tel–kel, dal–gal)', true],
        ['far', 'Sesbilgisel farkındalık etkinlikleri, aile eğitimi', true],
        ['ses', 'Ses hijyeni ve rezonant ses terapisi', false],
        ['lsvt', 'LSVT LOUD', false]
      ],
      ozet: 'Hata tek bir sese değil, bir ses sınıfına (arka damak) yayılmış ve sesi tek başına üretebiliyor: bu motor değil, sesbilgisel (fonolojik) bir örüntü. Kuralı fark ettiren minimal çift çalışması uygundur.'
    },
    {
      id: 'kek', ad: 'Zeynep', yas: '4 yaş', ikon: 'cocuk', renk: '#C9DDF6',
      sikayet: 'Ailesi 8 aydır "ba-ba-ba-baba" gibi tekrarlar ve sözcük başında takılmalar olduğunu, son haftalarda göz kırpmanın eklendiğini anlatıyor.',
      oyku: 'Babasında çocuklukta kekemelik öyküsü var. Dil gelişimi yaşına uygun. Takılmalar heyecanlıyken artıyor; Zeynep bazen "ben konuşamıyorum" diyor.',
      deg: [
        ['pct', 'Farklı ortamlardan konuşma örneği: %TH ve akıcısızlık türleri', true],
        ['eslik', 'Eşlik eden fiziksel davranışlar ve takılma süresi', true],
        ['tutum', 'Çocuğun ve ailenin konuşmaya tutumu, aile görüşmesi', true],
        ['sst', 'Sesletim ve dil taraması', true],
        ['vfss', 'Videofloroskopik yutma çalışması', false],
        ['grbas', 'GRBAS ile ses kalitesi derecelendirmesi', false]
      ],
      bulgu: 'Konuşma örneğinde %TH yaklaşık 9; çoğunlukla ses/hece tekrarı ve uzatma, zaman zaman bloklar. Takılmalara göz kırpma eşlik ediyor. Sesletim ve dil gelişimi yaşına uygun.',
      tani: [
        ['gel', 'Gelişimsel kekemelik (okul öncesi)', true],
        ['nor', 'Normal gelişimsel akıcısızlık, izlem yeterli', false],
        ['hiz', 'Hızlı-bozuk konuşma (cluttering)', false],
        ['noro', 'Edinilmiş nörojenik kekemelik', false]
      ],
      terapi: [
        ['lid', 'Lidcombe Programı (ebeveyn yürütmeli, okul öncesi)', true],
        ['aile', 'Aile danışmanlığı ve konuşma ortamının düzenlenmesi', true],
        ['bekle', 'Hiç müdahale etmeden 2 yıl bekleme', false],
        ['mit', 'Melodik entonasyon terapisi', false]
      ],
      ozet: 'Başlangıçtan bu yana 6 aydan uzun süre geçmiş, ailede kekemelik var, eşlik eden davranış ve farkındalık başlamış: bunlar kendiliğinden geçme olasılığını düşüren risk etkenleridir. Okul öncesi dönemde ebeveyn yürütmeli Lidcombe Programı güçlü kanıta sahiptir.'
    },
    {
      id: 'afazi', ad: 'Hasan Bey', yas: '62 yaş', ikon: 'yetiskin', renk: '#DCCFF2',
      sikayet: 'Üç hafta önce sol orta serebral arter inmesi geçirmiş. Eşi "ne demek istediğini anlıyorum ama sözcükler çıkmıyor" diyor.',
      oyku: 'Sağ kol ve bacakta güçsüzlük var. Sağ elini kullanan, emekli öğretmen. Kendi durumunun farkında, konuşamayınca üzülüyor.',
      deg: [
        ['bat', 'Standart afazi bataryası: kendiliğinden konuşma, anlama, tekrar, adlandırma', true],
        ['adl', 'Adlandırma ve sözcük bulma görevleri', true],
        ['okyaz', 'Okuma ve yazma değerlendirmesi', true],
        ['yut', 'Yatak başı yutma taraması', true],
        ['sst', 'Çocuklar için sesletim testi', false],
        ['pct', 'Konuşma örneğinde %TH', false]
      ],
      bulgu: 'Konuşma akıcı değil, zahmetli ve telgraf tarzında; işlev sözcükleri ve ekler düşüyor. Basit ve orta güçlükte yönergeleri anlıyor. Sözcük ve cümle tekrarı bozuk. Adlandırmada ipucuyla gelişme var. Yutma taraması temiz.',
      tani: [
        ['broca', 'Broca afazisi (akıcı olmayan afazi)', true],
        ['wernicke', 'Wernicke afazisi', false],
        ['dizartri', 'Yalnızca dizartri, dil sağlam', false],
        ['demans', 'Demansa bağlı bilişsel-iletişim bozukluğu', false]
      ],
      terapi: [
        ['mit', 'Melodik entonasyon terapisi', true],
        ['ipucu', 'İpucu hiyerarşisiyle adlandırma çalışması', true],
        ['aak', 'Destekleyici iletişim (resim panosu, yazı) ve eş eğitimi', true],
        ['lid', 'Lidcombe Programı', false]
      ],
      ozet: 'Akıcı olmayan konuşma + görece iyi anlama + bozuk tekrar Broca afazisini düşündürür. Sağlam sağ hemisferin melodi işlemesinden yararlanan melodik entonasyon terapisi, adlandırma çalışması ve destekleyici iletişim birlikte kullanılabilir.'
    },
    {
      id: 'pd', ad: 'Ayten Hanım', yas: '70 yaş', ikon: 'yetiskin', renk: '#BFE3D2',
      sikayet: 'Parkinson hastalığı tanısı 5 yıl önce konmuş. Ailesi sesinin çok kısıldığını, telefonda anlaşılmadığını söylüyor; kendisi "normal konuştuğunu" düşünüyor.',
      oyku: 'İlaç tedavisi düzenli. Yemekte zaman zaman öksürüyor. Kalabalık ortamlarda konuşmaktan kaçınmaya başlamış.',
      deg: [
        ['db', 'Ses şiddeti (dB) ve maksimum fonasyon süresi ölçümü', true],
        ['anl', 'Konuşma anlaşılırlığı ve prozodi değerlendirmesi', true],
        ['yut', 'Yutma değerlendirmesi (gerekirse aletli)', true],
        ['sst', 'Çocuklar için sesletim testi', false],
        ['lid', 'Ebeveyn görüşmesi', false]
      ],
      bulgu: 'Konuşmada ses şiddeti düşük ve monoton; hızlı kısa konuşma atakları, belirsiz ünsüzler. Maksimum fonasyon süresi kısa. Kendi sesini olduğundan yüksek algılıyor.',
      tani: [
        ['hipo', 'Hipokinetik dizartri', true],
        ['spast', 'Spastik dizartri', false],
        ['afazi', 'Afazi', false],
        ['nodul', 'Vokal nodül', false]
      ],
      terapi: [
        ['lsvt', 'LSVT LOUD: yoğun, yüksek eforlu ses şiddeti terapisi', true],
        ['yutma', 'Yutma için güvenli yutma stratejileri ve izlem', true],
        ['min', 'Minimal çift terapisi', false],
        ['sus', 'Ses istirahati: bir süre hiç konuşmaması', false]
      ],
      ozet: 'Parkinson\'da hipokinetik dizartri; azalmış ses şiddeti ve bozulmuş kendi sesini algılama tipiktir. LSVT LOUD tek hedefe ("yüksek sesle düşün") odaklanan yoğun bir protokoldür; yutma şikâyeti ayrıca izlenmelidir.'
    },
    {
      id: 'nodul', ad: 'Selin Hanım', yas: '34 yaş', ikon: 'yetiskin', renk: '#F9DE8F',
      sikayet: 'İlkokul öğretmeni. 6 aydır ses kısıklığı var, akşamları ve hafta sonu sonunda kötüleşiyor, sesi çabuk yoruluyor.',
      oyku: 'Kalabalık sınıflarda yüksek sesle konuşuyor, gün içinde az su içiyor. KBB muayenesinde iki taraflı vokal nodül saptanmış.',
      deg: [
        ['lar', 'KBB: laringoskopi / videolaringostroboskopi bulgusu', true],
        ['grbas', 'Algısal değerlendirme (GRBAS ya da CAPE-V)', true],
        ['akus', 'Akustik ve aerodinamik ölçümler: F0, MPT, s/z oranı', true],
        ['shi', 'Ses Handikap İndeksi (kendini değerlendirme)', true],
        ['vfss', 'Videofloroskopik yutma çalışması', false],
        ['pct', 'Konuşma örneğinde %TH', false]
      ],
      bulgu: 'GRBAS: G1 R1 B1 A0 S1. MPT 11 sn, s/z oranı yaklaşık 1,5 (z kısalıyor). Ses Handikap İndeksi işle ilgili alanda yüksek. Stroboskopide ön-orta üçte bir birleşiminde iki taraflı nodül, kapanmada kum saati görünümü.',
      tani: [
        ['nodul', 'Vokal nodüle bağlı ses bozukluğu (fonotravmatik)', true],
        ['paralizi', 'Tek taraflı ses teli felci', false],
        ['spazm', 'Spazmodik disfoni', false],
        ['afazi', 'Afazi', false]
      ],
      terapi: [
        ['hij', 'Ses hijyeni: su, ses dinlenme araları, mikrofon kullanımı', true],
        ['rez', 'Rezonant ses terapisi / vokal fonksiyon egzersizleri', true],
        ['lsvt', 'LSVT LOUD ile sesi yükseltme', false],
        ['min', 'Minimal çift terapisi', false]
      ],
      ozet: 'Nodüllerde ilk basamak ses terapisidir: zorlanmayı azaltan rezonant ses çalışması ve ses hijyeni. s/z oranının 1,4\'ü aşması ses tellerinde kapanma sorununu (kitle lezyonu gibi) düşündürür; ses şiddetini artırmak burada hedef değildir.'
    },
    {
      id: 'disfaji', ad: 'Necmi Bey', yas: '78 yaş', ikon: 'yetiskin', renk: '#FCE9DB',
      sikayet: 'İnme sonrası serviste yatıyor. Hemşire su içerken öksürdüğünü, yemekten sonra sesinin "gurultulu" olduğunu bildiriyor.',
      oyku: 'Sağ hemisfer inmesi. Son iki günde hafif ateş var. Ağızdan beslenmeye çalışılıyor.',
      deg: [
        ['yb', 'Yatak başı klinik yutma değerlendirmesi (su yutma testi dahil)', true],
        ['alet', 'Aletli değerlendirme: VFSS ya da FEES', true],
        ['oral', 'Oral-motor ve kranial sinir muayenesi', true],
        ['sst', 'Sesletim ve sesbilgisi testi', false],
        ['pct', 'Konuşma örneğinde %TH', false]
      ],
      bulgu: 'VFSS: ince sıvıda gecikmiş yutma refleksi; madde ses tellerinin altına geçiyor ve hasta öksürmüyor (PAS 8). Hafif koyu sıvıda madde ses tellerinin üstünde kalıp atılıyor (PAS 2). Püre kıvamında güvenli yutuyor.',
      tani: [
        ['ofd', 'Orofaringeal disfaji, sessiz aspirasyon', true],
        ['ozof', 'Özofageal disfaji', false],
        ['normal', 'Yutma normal, izlem yeterli', false],
        ['noduler', 'Vokal nodül', false]
      ],
      terapi: [
        ['kivam', 'Kıvam düzenlemesi: IDDSI 2 sıvı, 4 püre (aletli bulguya göre)', true],
        ['postur', 'Telafi edici stratejiler: çene aşağı postür, küçük yudum, gözetim', true],
        ['agiz', 'Ağız bakımı ve ekiple (hekim, diyetisyen, hemşire) iş birliği', true],
        ['ince', 'İnce sıvıya devam, pipetle hızlı içme', false]
      ],
      ozet: 'Öksürük refleksi olmadan ses tellerinin altına geçiş (PAS 8) sessiz aspirasyondur; yatak başı testte gözden kaçabilir, aletli değerlendirme gerekir. Kıvam ve postür düzenlemesi aletli bulguya göre yapılır; ağız bakımı aspirasyon pnömonisi riskini azaltır.'
    },
    /* ---- 31.10.2026: Acadex Medica yeni vakaları (osman: İnme zinciri, kerem: Odyoloji'den sevk) ---- */
    {
      id: 'osman', ad: 'Osman Bey', yas: '72 yaş', ikon: 'yetiskin', renk: '#D7E6F6',
      sikayet: 'Sol yarıküre inmesiyle dün akşam yoğun bakıma yatırılmış. Ağızdan hiçbir şey verilmemiş; nöroloji "beslenme yolu kararı için yutma değerlendirmesi" istiyor.',
      oyku: 'Bilinci açık, komutlara kısmen uyuyor; sağ yüzde ve kolda güçsüzlük var, konuşması çok az. Ağız içinde tükürük birikiyor. Kızı yanında.',
      deg: [
        ['yb', 'Yatak başı yutma taraması (önce bilinç ve postür, sonra kademeli su yutma)', true],
        ['oral', 'Oral-motor ve kranial sinir muayenesi (dudak, dil, yumuşak damak, öksürük)', true],
        ['alet', 'Gerekirse aletli değerlendirme planı (FEES)', true],
        ['sst', 'Sesletim ve sesbilgisi testi', false],
        ['grbas', 'GRBAS ile ses kalitesi derecelendirmesi', false],
        ['pct', 'Konuşma örneğinde %TH', false]
      ],
      bulgu: 'Sağ dudak ve dil hareketleri zayıf, sağ yüz asimetrik. İstemli öksürük zayıf. Üç çay kaşığı suyun ilkinde yutma gecikiyor, ikincisinde ıslak ses ve öksürük. Tarama başarısız.',
      tani: [
        ['ofd', 'Orofaringeal disfaji (akut inme), ağızdan beslenme şu an güvenli değil', true],
        ['ozof', 'Özofageal disfaji', false],
        ['normal', 'Yutma normal, normal diyete geçilebilir', false],
        ['kek', 'Edinilmiş nörojenik kekemelik', false]
      ],
      terapi: [
        ['ng', 'Ağızdan beslenmeyi bekletip geçici tüple (NG) beslenmeyi ekibe önermek; diyetisyene konsültasyon', true],
        ['agiz', 'Düzenli ağız bakımı, yatak başını 30–45° kaldırmak', true],
        ['takip', 'Her gün yeniden değerlendirme; uygun olunca aletli değerlendirme ve kademeli oral deneme', true],
        ['su', 'Susadığı için pipetle bol su vermek', false]
      ],
      ozet: 'İnmenin ilk saatlerinde ağızdan bir şey verilmeden önce yutma taraması yapılır. Islak ses ve öksürük taramanın başarısız olduğunu gösterir: oral alım bekletilir, beslenme geçici tüple sürdürülür ve diyetisyen enteral planı yapar. Yutma çoğu hastada ilk haftalarda düzelir; günlük yeniden değerlendirme şarttır.'
    },
    {
      id: 'kerem', ad: 'Kerem', yas: '4 yaş', ikon: 'cocuk', renk: '#CFE9D9',
      sikayet: 'Odyoloji polikliniğinden sevkle geldi: iki taraflı orta derece sensörinöral işitme kaybı saptanmış, işitme cihazları yeni takılmış. Yalnızca 10–15 sözcük kullanıyor.',
      oyku: 'Tek çocuk. Oyun oynamayı seviyor, göz teması iyi. İstediğini işaret ederek ve çekiştirerek anlatıyor. Ailesi cihazı günde birkaç saat taktırabiliyor.',
      deg: [
        ['dilt', 'Alıcı ve ifade edici dil değerlendirmesi (standart test + dil örneği)', true],
        ['cihaz', 'Cihazla işitsel algı ve günlük cihaz kullanım süresinin değerlendirilmesi', true],
        ['etk', 'İletişim ve oyun becerilerinin gözlemi, aile görüşmesi', true],
        ['vfss', 'Videofloroskopik yutma çalışması', false],
        ['grbas', 'GRBAS ile ses kalitesi derecelendirmesi', false],
        ['pct', 'Konuşma örneğinde %TH', false]
      ],
      bulgu: 'Alıcı dil yaklaşık 2 yaş, ifade edici dil yaklaşık 18 ay düzeyinde. Cihazla konuşma seslerine yanıt veriyor; cihaz günde ortalama 4 saat takılıyor. Oyun ve sosyal etkileşim yaşına uygun.',
      tani: [
        ['isd', 'İşitme kaybına bağlı dil ve konuşma gecikmesi', true],
        ['otizm', 'Otizm spektrum bozukluğu', false],
        ['cas', 'Çocukluk çağı konuşma apraksisi', false],
        ['nor', 'Normal gelişim, izlem yeterli', false]
      ],
      terapi: [
        ['avt', 'İşitsel-sözel temelli dil terapisi, aile koçluğu', true],
        ['tamgun', 'Cihazın uyanık olduğu her saatte takılması için aile eğitimi; odyolojiyle düzenli iş birliği', true],
        ['bekle', 'Cihaz alıştıktan bir yıl sonra terapiye başlamak', false],
        ['lsvt', 'LSVT LOUD', false]
      ],
      ozet: 'Oyun ve sosyal etkileşim yaşına uygun, dil gerilemesi işitsel girdinin eksikliğine bağlı. Dil gelişimi için kritik dönemde cihaz tüm gün takılmalı ve aileyi merkeze alan işitsel-sözel terapi hemen başlamalıdır. Odyolog ile DKT uzmanı birlikte izler.'
    },
    {
      id: 'yarik', ad: 'Mira', yas: '6 yaş', ikon: 'cocuk', renk: '#F6D9E4',
      sikayet: 'Ailesi konuşmasının "burundan geldiğini", "p, b, s" seslerini çıkaramadığını, içerken sıvının burnundan geldiğini anlatıyor.',
      oyku: 'Doğuştan yarık damak; 1 yaşında onarılmış. Sık orta kulak iltihabı geçirmiş. Okulda arkadaşları konuşmasını taklit ediyor, sınıfta konuşmak istemiyor.',
      deg: [
        ['rez', 'Rezonans değerlendirmesi (hipernazalite, nazal emisyon; ayna ve dinleme)', true],
        ['sst', 'Sesletim testi: basınç gerektiren seslerde telafi edici üretimler', true],
        ['isitme', 'İşitme değerlendirmesi (odyolojiye yönlendirme)', true],
        ['vfss', 'Videofloroskopik yutma çalışması', false],
        ['pct', 'Konuşma örneğinde %TH', false]
      ],
      bulgu: 'Orta derece hipernazalite ve "p, b, t, s" seslerinde nazal emisyon. "p" yerine gırtlaktan glottal durak üretiyor. Ayna testinde ünlülerde buğulanma var.',
      tani: [
        ['vpd', 'Velofaringeal yetmezlik ile birlikte yarık damağa bağlı konuşma bozukluğu', true],
        ['fon', 'Konuşma sesi bozukluğu: fonolojik', false],
        ['nodul', 'Vokal nodül', false],
        ['kek', 'Gelişimsel kekemelik', false]
      ],
      terapi: [
        ['ekip', 'Yarık damak ekibine (plastik cerrahi) velofaringeal görüntüleme için yönlendirme', true],
        ['yer', 'Telafi edici üretimler (glottal durak) için doğru ağız içi yer öğretimi', true],
        ['ufle', 'Yalnızca balon şişirme ve üfleme egzersizleri', false],
        ['lid', 'Lidcombe Programı', false]
      ],
      ozet: 'Hipernazalite ve nazal emisyon yapısal bir sorunu (velofaringeal yetmezlik) düşündürür: terapi yapıyı düzeltmez, görüntüleme ve cerrahi değerlendirme gerekir. Glottal durak gibi telafi edici üretimler ise öğrenilmiş davranıştır ve terapiyle düzelir. Üfleme egzersizlerinin konuşmaya etkisi gösterilmemiştir.'
    },
    {
      id: 'ykek', ad: 'Mert', yas: '24 yaş', ikon: 'yetiskin', renk: '#E4DDF6',
      sikayet: 'Yazılım mühendisi; iş görüşmelerinde ve telefonda sözcük başında kilitlendiğini, adını söylerken zorlandığını anlatıyor.',
      oyku: 'Kekemelik 4 yaşından beri var; çocukken kısa süre terapi almış. Telefonu açmamak için mesaj atıyor, restoranda istemediği yemeği sipariş ettiği oluyor. Yakında önemli bir iş görüşmesi var.',
      deg: [
        ['pct', 'Farklı ortamlardan konuşma örneği: %TH, blok süresi ve türü', true],
        ['tutum', 'Kaçınma, kaygı ve yaşam kalitesi ölçeği (ör. OASES)', true],
        ['eslik', 'Eşlik eden fiziksel davranışlar', true],
        ['vfss', 'Videofloroskopik yutma çalışması', false],
        ['sst', 'Çocuk sesletim testi', false]
      ],
      bulgu: 'Okuma ve monologda %TH ≈ 6, telefonda ≈ 12; çoğunlukla 2–3 saniyelik bloklar, göz kırpma ve baş hareketi. Kaçınma ve konuşma kaygısı yüksek.',
      tani: [
        ['yet', 'Erişkin gelişimsel kekemelik, yüksek kaçınma ve kaygı', true],
        ['hiz', 'Hızlı-bozuk konuşma (cluttering)', false],
        ['noro', 'Edinilmiş nörojenik kekemelik', false],
        ['nor', 'Normal akıcısızlık', false]
      ],
      terapi: [
        ['tek', 'Konuşmayı biçimlendirme ve kekemeliği değiştirme tekniklerinin birlikte kullanımı', true],
        ['bdt', 'Kaçınma ve kaygıya yönelik bilişsel-davranışçı yaklaşım, gerçek ortam alıştırmaları (telefon, görüşme provası)', true],
        ['sus', 'Takılınca susup cümleyi değiştirmeyi öğretmek', false],
        ['min', 'Minimal çift terapisi', false]
      ],
      ozet: 'Erişkinde amaç kekemeliği tamamen yok etmek değil, akıcılığı artırmak ve kaçınmayı azaltmaktır. Sözcük değiştirme ve susma kısa vadede rahatlatır ama kaçınmayı besler. Teknik çalışmayla birlikte kaygıya yönelik yaklaşım ve gerçek ortam alıştırmaları güçlü sonuç verir.'
    }
  ];

  /* yardımcı: Türkçe hece sayısı (ünlü sayısı) */
  V.hece = function (s) { var m = String(s || '').toLocaleLowerCase('tr').match(/[aeıioöuüâîû]/g); return m ? m.length : 0; };
})();
