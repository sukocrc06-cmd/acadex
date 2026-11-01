/* ==========================================================================
   ACADEX KLİNİK · Eczacılık Lab senaryoları (labs/klinik/senaryo-eczacilik.js), 01.11.2026
   Acadex Medica 6. kat (hastane eczanesi): Eczacılık Lab vaka masasındaki 8 vaka
   (ecz-veri.js → VAKA) için sahne: karşılama → ilaç öyküsü → kontrol → karar →
   vaka masasına devir (kontroller → ilaçla ilgili sorun → müdahale).
   Hasta adı ve yaşı vaka dosyasıyla AYNIDIR (tests/eczacilik-hemsirelik.js denetler).
   Sahnedeki karar sorunun adını söylemez; o, vaka masasında puanlanır.
   EĞİTİM AMAÇLIDIR; vakalar kurgusaldır.
   ========================================================================== */
(function (root, factory) {
  var L = factory();
  if (typeof module === 'object' && module.exports) module.exports = L;
  else if (root.AXKLINIK) root.AXKLINIK.ekle(L);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var ECZ = { ad: 'Tolga', unvan: 'Ecz.', cins: 'E' };
  var S = function (id, t, cevap, puan, not, kim, geri) { return { id: id, t: t, cevap: cevap, puan: puan, not: not || null, kim: kim || null, geri: geri || null }; };
  var E = function (id, t, sonuc, puan, o) { return Object.assign({ id: id, t: t, sonuc: sonuc, puan: puan }, o || {}); };
  var K = function (baslik, soru, secenek) { return { tip: 'karar', baslik: baslik, soru: soru, secenek: secenek.map(function (x) { return { t: x[0], dogru: !!x[1], geri: x[2] }; }) }; };
  var MASA = function (metin) { return { tip: 'devir', metin: metin, dugme: 'Vaka masasına geç', hedef: 'vaka' }; };
  var YARGI = function (kim, t, cevap, geri) { return S('yargi', t, cevap, -2, null, kim, geri || 'Suçlayıcı ya da küçümseyen soru güveni sarsar; hasta ilaç öyküsünü eksik anlatır.'); };
  var ODA = 'eczane', ODAAD = 'Hastane eczanesi danışma tezgâhı';

  return [
    /* ------------------------------ Klaritromisin + simvastatin ------------------------------ */
    { id: 'ecz-klaritro', vaka: 'klaritro', lab: 'eczacilik', oda: ODA, odaAd: ODAAD, baslik: 'Zatürre için yeni antibiyotik',
      hasta: { ad: 'Hüseyin', hitap: 'Hüseyin Bey', yas: 71, cins: 'E', gorunum: 'yasli', poz: 'ayakta' }, mentor: ECZ,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Doktor zatürre dedi, bu antibiyotiği yazdı. Kolesterol ve tansiyon hapımı da içmeye devam edeyim, değil mi?' },
        { tip: 'sor', baslik: 'İlaç öyküsü', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('ilac', 'Düzenli kullandığınız bütün ilaçları sayar mısınız?', 'Akşamları kolesterol için simvastatin 40, sabah tansiyon için ramipril.', 3, 'İlaç|Simvastatin 40 mg akşam, ramipril 5 mg sabah.'),
          S('otc', 'Reçetesiz aldığınız bir ilaç ya da bitkisel ürün var mı?', 'Yok, sadece bunlar.', 2, 'Reçetesiz|Yok.'),
          S('kas', 'Kas ağrısı ya da halsizlik yaşadınız mı?', 'Şimdilik yok.', 2, 'Kas|Kas ağrısı yok.'),
          S('alerji', 'Bilinen bir ilaç alerjiniz var mı?', 'Hayır.', 2, 'Alerji|Yok.'),
          S('takim', 'Hangi takımı tutuyorsunuz?', 'Ankaragücü!', 0),
          YARGI('hasta', 'Bu kadar ilacı nasıl karıştırmadan içiyorsunuz ki?', 'Kızım kutulara ayırıyor…')
        ] },
        { tip: 'eylem', baslik: 'Kontrol', yonerge: 'gerekenleri yap', secenek: [
          E('tara', 'Yeni antibiyotiği ilaç listesiyle etkileşim açısından tara', 'Veritabanı uyarısı: klaritromisin güçlü CYP3A4 inhibitörü; simvastatinle birlikte kontrendike.', 3),
          E('kreatinin', 'Dosyadan son böbrek değerine bak', 'Kreatinin klirensi 68 ml/dk; antibiyotik dozu için ayar gerekmez.', 2),
          E('ver', 'Kutuları hemen verip hastayı gönder', 'Hüseyin Bey kapıya yöneldi.', -3, { geri: 'Etkileşim taranmadan ilaç verilmez; burada ciddi bir risk var.' })
        ] },
        K('Ne söylersin?', 'Hüseyin Bey soruyor: “Hepsini birlikte içerim, olmaz mı?”', [
          ['Antibiyotik süresince kolesterol ilacına ara verilmesi gerekebilir; doktorunuzla hemen görüşüp size net bilgi vereceğim', true, 'Doğru. Eczacı kendi başına kesme kararı vermez; hekime gerekçeyle bildirir ve hastaya ne yapacağını net söyler.'],
          ['Evet, hepsini birlikte için', false, 'Statin ve güçlü CYP3A4 inhibitörü birlikte kas yıkımına yol açabilir.'],
          ['Antibiyotiği hiç kullanmayın', false, 'Zatürre tedavisiz kalamaz; çözüm hekimle birlikte bulunur.']
        ]),
        MASA('Vaka masasında kontrolleri seç, ilaçla ilgili sorunu belirle ve müdahaleni yaz.')
      ] },

    /* ------------------------------ Varfarin + NSAİİ ------------------------------ */
    { id: 'ecz-varfarin', vaka: 'varfarin', lab: 'eczacilik', oda: ODA, odaAd: ODAAD, baslik: 'Diz ağrısına yeni ağrı kesici',
      hasta: { ad: 'Necati', hitap: 'Necati Bey', yas: 74, cins: 'E', gorunum: 'yasli', poz: 'ayakta' }, mentor: ECZ,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Dizim çok ağrıyor, ibuprofen yazdılar. Bir de son kan tahlilinde INR 3,6 çıktı.' },
        { tip: 'sor', baslik: 'İlaç öyküsü', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('ilac', 'Kan sulandırıcınızın adı ve dozu ne?', 'Varfarin 5 mg, her akşam.', 3, 'İlaç|Varfarin 5 mg akşam.'),
          S('kanama', 'Diş eti, burun kanaması ya da morarma oluyor mu?', 'Dişlerimi fırçalarken biraz kanıyor.', 3, 'Kanama|Diş eti kanaması.'),
          S('diski', 'Dışkınız siyah ya da idrarınız koyu oldu mu?', 'Hayır, fark etmedim.', 2, 'Gİ|Melena yok.'),
          S('spor', 'Spor yapıyor musunuz?', 'Biraz yürüyorum.', 0),
          YARGI('hasta', 'INR’niz neden bu kadar yüksek, ilacınızı karıştırıyor musunuz?', 'Bilmiyorum… doğru içiyorum.')
        ] },
        { tip: 'eylem', baslik: 'Kontrol', yonerge: 'gerekenleri yap', secenek: [
          E('tara', 'Yeni ilacı varfarinle etkileşim açısından tara', 'Ciddi etkileşim: NSAİİ + varfarin kanama riskini belirgin artırır.', 3),
          E('inr', 'INR trendine bak', 'Üç ay önce 2,4; şimdi 3,6 (hedef 2–3).', 2),
          E('cift', 'Ağrı geçsin diye çift doz önermek', 'Necati Bey şaşırdı.', -3, { geri: 'Antikoagülan kullanan hastada NSAİİ dozunu artırmak kanamayı daha da kolaylaştırır.' })
        ] },
        K('Ne önerirsin?', 'Necati Bey: “Ağrım geçmezse ne yapacağım?”', [
          ['Doktorunuzla görüşüp ağrı için güvenli bir seçenek (parasetamol) önereceğim; INR’nizin yakında kontrol edilmesi gerekiyor', true, 'Doğru. Güvenli analjezik ve INR izlemi birlikte planlanır.'],
          ['İbuprofeni alın, varfarini birkaç gün bırakın', false, 'Varfarini kendi başına bırakmak inme riskini artırır.'],
          ['Ağrıya katlanın', false, 'Hastayı çaresiz bırakmak çözüm değil; güvenli alternatif var.']
        ]),
        MASA('Vaka masasında kontrolleri seç, ilaçla ilgili sorunu belirle ve müdahaleni yaz.')
      ] },

    /* ------------------------------ Çocukta şurup dozu ------------------------------ */
    { id: 'ecz-pediatri', vaka: 'pediatri', lab: 'eczacilik', oda: ODA, odaAd: ODAAD, baslik: 'Ateş şurubunun dozu',
      hasta: { ad: 'Elif', hitap: 'Elif', yas: 4, cins: 'K', gorunum: 'cocuk', poz: 'ayakta' }, refakat: { ad: 'Annesi', cins: 'K', gorunum: 'yetiskin', kiyafet: '#7A4FA8' }, mentor: ECZ,
      adimlar: [
        { tip: 'konus', kim: 'refakat', metin: 'Doktor günde dört kez 15 ml yazdı. Bu çok mu? Kızım 16 kilo.' },
        { tip: 'sor', baslik: 'Anneyle görüşme', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('kilo', 'Elif’in kilosunu en son ne zaman tarttınız?', 'Geçen hafta, 16 kilo.', 3, 'Kilo|16 kg (bir hafta önce).', 'refakat'),
          S('diger', 'Evde başka ateş düşürücü ya da soğuk algınlığı şurubu veriyor musunuz?', 'Dün bir grip şurubu verdim.', 3, 'Diğer|Dün grip şurubu verilmiş.', 'refakat'),
          S('olcek', 'Şurubu neyle ölçüyorsunuz?', 'Çay kaşığıyla.', 2, 'Ölçme|Çay kaşığı.', 'refakat'),
          S('okul', 'Kreşe gidiyor mu?', 'Evet.', 0, null, 'refakat'),
          YARGI('refakat', 'Ateşi bu kadar yükselene kadar neden beklediniz?', 'Gece başladı…')
        ] },
        { tip: 'eylem', baslik: 'Kontrol', yonerge: 'gerekenleri yap', secenek: [
          E('hesap', 'Dozu mg/kg’a çevir', '15 ml × 24 mg/ml = 360 mg → 22,5 mg/kg/doz; önerilen 10–15 mg/kg/doz.', 3),
          E('icerik', 'Grip şurubunun içeriğine bak', 'Grip şurubunda da parasetamol var.', 3),
          E('ver', 'Şurubu verip “doktor ne dediyse” de', 'Anne tedirgin ayrılıyor.', -3, { geri: 'Doz aşımı fark edilmeden gönderilmek çocuğun karaciğerini riske atar.' })
        ] },
        K('Anneye ne söylersin?', 'Anne: “O zaman kaç ml vereyim?”', [
          ['Doktorunuzla görüşüp kiloya uygun dozu birlikte netleştireceğim; ölçeği gösterip grip şurubunu kesmenizi isteyeceğim', true, 'Doğru. Eczacı dozu hekimle düzeltir, ölçme aracını gösterir ve mükerrer parasetamolü yakalar.'],
          ['15 ml verin, ateş inatçıysa artırın', false, 'Bu doz zaten önerilenin üzerinde.'],
          ['İstediğiniz kadar verin, şurup zararsız', false, 'Parasetamol fazlası karaciğere zarar verir.']
        ]),
        MASA('Vaka masasında kontrolleri seç, ilaçla ilgili sorunu belirle ve müdahaleni yaz.')
      ] },

    /* ------------------------------ Penisilin alerjisi ------------------------------ */
    { id: 'ecz-penisilin', vaka: 'penisilin', lab: 'eczacilik', oda: ODA, odaAd: ODAAD, baslik: 'Diş apsesi için antibiyotik',
      hasta: { ad: 'Derya', hitap: 'Derya Hanım', yas: 38, cins: 'K', gorunum: 'yetiskin', poz: 'ayakta' }, mentor: ECZ,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Dişim apse yapmış, antibiyotik yazdılar. Geçen yıl bir iğneden sonra dudaklarım şişmişti, o da sorun olur mu?' },
        { tip: 'sor', baslik: 'Alerji öyküsü', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('alerji', 'Hangi ilaçtan sonra, nasıl bir tepki oldu?', 'Penisilin iğnesinden sonra dudaklarım şişti, kaşıntılı kabarıklıklar çıktı.', 3, 'Alerji|Penisilin → dudak şişmesi, ürtiker.'),
          S('kayit', 'Bu alerji dosyanıza ya da e-reçeteye işlendi mi?', 'Bilmiyorum, kimse sormadı.', 3, 'Kayıt|Alerji kayıtlı değil.'),
          S('ilac', 'Düzenli ilaç kullanıyor musunuz?', 'Hayır.', 1, 'İlaç|Yok.'),
          S('tatil', 'Yakında tatile çıkacak mısınız?', 'Belki.', 0),
          YARGI('hasta', 'Bunu doktora neden söylemediniz?', 'Unuttum…')
        ] },
        { tip: 'eylem', baslik: 'Kontrol', yonerge: 'gerekenleri yap', secenek: [
          E('grup', 'Reçetedeki ilacın grubuna bak', 'Amoksisilin-klavulanat bir penisilindir.', 3),
          E('kayit', 'Alerji kaydını kontrol et', 'Sistemde alerji kaydı yok.', 2),
          E('test', 'Eczanede deri testi yap', 'Derya Hanım şaşırıyor.', -2, { geri: 'Alerji testi eczanede yapılmaz; anjiyoödem öyküsü varsa ilaç zaten kontrendikedir.' })
        ] },
        K('Ne yaparsın?', 'Derya Hanım: “Bu ilacı alayım mı?”', [
          ['Bu ilacı vermeyeceğim; doktorunuzla görüşüp penisilin dışı bir antibiyotik isteyeceğim ve alerjinizi kayda geçireceğim', true, 'Doğru. Anjiyoödem öyküsü ciddi alerji demektir; kayıt da gelecekteki hataları önler.'],
          ['Yanına alerji hapı verip kullanabilirsiniz', false, 'Antihistaminik anafilaksiyi önlemez.'],
          ['Dozu yarıya indirelim', false, 'Alerji dozdan bağımsızdır.']
        ]),
        MASA('Vaka masasında kontrolleri seç, ilaçla ilgili sorunu belirle ve müdahaleni yaz.')
      ] },

    /* ------------------------------ Levotiroksin zamanlaması ------------------------------ */
    { id: 'ecz-tiroid', vaka: 'tiroid', lab: 'eczacilik', oda: ODA, odaAd: ODAAD, baslik: 'Tiroid ilacı işe yaramıyor',
      hasta: { ad: 'Nazlı', hitap: 'Nazlı Hanım', yas: 29, cins: 'K', gorunum: 'yetiskin', poz: 'ayakta' }, mentor: ECZ,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Gebeliğimde tiroid ilacı başlandı ama TSH’m yükselmiş. Doz yetmiyor galiba.' },
        { tip: 'sor', baslik: 'İlaç öyküsü', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('saat', 'İlaçlarınızı hangi saatte, neyle alıyorsunuz?', 'Sabah kahvaltıda; tiroid, demir ve kalsiyumu birlikte, çayla.', 3, 'Zamanlama|Üçü birlikte kahvaltıda.'),
          S('ilac', 'Başka hangi ilaç ve vitaminleri kullanıyorsunuz?', 'Demir ve kalsiyum, bir de gebelik vitamini.', 3, 'İlaç|Demir, kalsiyum, gebelik vitamini.'),
          S('atlama', 'Doz atladığınız oluyor mu?', 'Hayır, hiç atlamıyorum.', 2, 'Uyum|Atlamıyor.'),
          S('isim', 'Bebeğin adını koydunuz mu?', 'Henüz değil!', 0),
          YARGI('hasta', 'Gebelikte bu kadar ilaç içmek doğru mu sizce?', 'Doktor öyle dedi…')
        ] },
        { tip: 'eylem', baslik: 'Kontrol', yonerge: 'gerekenleri yap', secenek: [
          E('tara', 'Emilim etkileşimlerini tara', 'Demir ve kalsiyum levotiroksin emilimini azaltır; arada en az 4 saat olmalı.', 3),
          E('cizelge', 'Saat çizelgesi taslağı hazırla', 'Sabah 7: levotiroksin; 11: demir; 15: kalsiyum.', 2),
          E('kes', 'Demiri bırakmasını söyle', 'Nazlı Hanım endişeleniyor.', -2, { geri: 'Gebelikte demir eksikliği tedavisi gerekli; çözüm zamanlamadır.' })
        ] },
        K('Ne söylersin?', 'Nazlı Hanım: “Dozumu artırmalı mıyım?”', [
          ['Önce zamanlamayı düzeltelim: levotiroksini sabah aç karnına yalnız suyla, diğerlerini 4 saat sonra alın; TSH’nin kontrolünü doktorunuzla planlayalım', true, 'Doğru. Etkisizlik çoğu zaman emilimden kaynaklanır; doz değişikliği hekimin kararıdır.'],
          ['Dozu kendiniz iki katına çıkarın', false, 'Doz değişikliği hekim kararıdır; gebelikte aşırı doz da zararlıdır.'],
          ['Tiroid ilacını bırakın', false, 'Gebelikte hipotiroidi tedavisiz bırakılmamalı.']
        ]),
        MASA('Vaka masasında kontrolleri seç, ilaçla ilgili sorunu belirle ve müdahaleni yaz.')
      ] },

    /* ------------------------------ Serotonin sendromu ------------------------------ */
    { id: 'ecz-serotonin', vaka: 'serotonin', lab: 'eczacilik', oda: ODA, odaAd: ODAAD, baslik: 'Titreme ve terleme',
      hasta: { ad: 'Sevim', hitap: 'Sevim Hanım', yas: 67, cins: 'K', gorunum: 'yasli', poz: 'ayakta', ifade: 'endise' }, mentor: ECZ, vital: { nabiz: 112, ta: '152/88', spo2: 97, ates: 38.1 },
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Üç gündür bel ağrısı için yeni bir ilaç içiyorum. Dün akşamdan beri titriyorum, terliyorum, içim içime sığmıyor.' },
        { tip: 'sor', baslik: 'İlaç öyküsü', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('ilac', 'Düzenli kullandığınız bütün ilaçlar neler?', 'Depresyon için sertralin 100 mg; tansiyon ilacı. Üç gündür de tramadol.', 3, 'İlaç|Sertralin 100 mg + tramadol 3 gündür.'),
          S('baslama', 'Belirtiler yeni ilaçtan sonra mı başladı?', 'Evet, ikinci günden sonra.', 3, 'Başlangıç|Tramadolden sonra.'),
          S('kasilma', 'Kaslarınızda seğirme ya da kasılma var mı?', 'Bacaklarım kendi kendine sıçrıyor.', 2, 'Bulgu|Miyoklonus.'),
          S('hava', 'Bugün hava çok sıcak, değil mi?', 'Evet.', 0),
          YARGI('hasta', 'Belki sadece heyecanlısınızdır, değil mi?', 'Hayır, bu başka bir şey…')
        ] },
        { tip: 'eylem', baslik: 'Kontrol', yonerge: 'gerekenleri yap', secenek: [
          E('vital', 'Ateşini ve nabzını ölç', 'Ateş 38,1 °C, nabız 112.', 3, { anim: 'monitor' }),
          E('tara', 'İki ilacı birlikte tara', 'Sertralin + tramadol: serotonin sendromu riski (ciddi).', 3),
          E('artir', 'Ağrı için tramadol dozunu artırmasını öner', 'Sevim Hanım’ın titremesi arttı.', -3, { ifade: 'agri', geri: 'Serotonerjik ilacı artırmak tabloyu ağırlaştırır.' })
        ] },
        K('Ne yaparsın?', 'Belirtiler belirgin ve ateş var.', [
          ['Hekime hemen ulaşıp tramadolün kesilmesini ve hastanın değerlendirilmesini isterim; hastayı yalnız bırakmam', true, 'Doğru. Şüphelenilen serotonin sendromunda serotonerjik ilaç kesilir ve hasta hekimce değerlendirilir.'],
          ['Ateş düşürücü verip eve gönderirim', false, 'Altta yatan nedeni çözmez.'],
          ['Sertralini birden bıraktırırım, tramadole devam', false, 'Asıl yeni eklenen ve kesilmesi gereken tramadol; karar hekimle verilir.']
        ]),
        MASA('Vaka masasında kontrolleri seç, ilaçla ilgili sorunu belirle ve müdahaleni yaz.')
      ] },

    /* ------------------------------ Lityum + NSAİİ ------------------------------ */
    { id: 'ecz-lityum', vaka: 'lityum', lab: 'eczacilik', oda: ODA, odaAd: ODAAD, baslik: 'Bulantı ve el titremesi',
      hasta: { ad: 'Orhan', hitap: 'Orhan Bey', yas: 58, cins: 'E', gorunum: 'yetiskin', poz: 'ayakta' }, mentor: ECZ,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Bir haftadır bulantım var, ellerim de titriyor. Bel ağrım için naproksen kullanıyorum.' },
        { tip: 'sor', baslik: 'İlaç öyküsü', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('ilac', 'Düzenli kullandığınız ilaçlar neler?', 'Lityum, günde iki kez 300 mg. Yıllardır kullanıyorum.', 3, 'İlaç|Lityum 2 × 300 mg.'),
          S('duzey', 'Son lityum düzeyiniz ne zaman ölçüldü?', 'Üç ay önce; normalmiş.', 2, 'Düzey|3 ay önce normal.'),
          S('sivi', 'İshal, kusma ya da az su içme oldu mu?', 'Pek su içmiyorum aslında.', 3, 'Sıvı|Az su içiyor.'),
          S('emekli', 'Ne zaman emekli oluyorsunuz?', 'İki yıla.', 0),
          YARGI('hasta', 'İlaçlarınızı kendiniz mi seçiyorsunuz?', 'Hayır, doktorum verdi…')
        ] },
        { tip: 'eylem', baslik: 'Kontrol', yonerge: 'gerekenleri yap', secenek: [
          E('tara', 'Naproksen ile lityumu birlikte tara', 'NSAİİ’ler böbrekten lityum atılımını azaltır: toksisite riski (ciddi).', 3),
          E('titreme', 'Titremenin tipini gözle', 'İnce, sürekli el titremesi.', 2),
          E('devam', '“Bir şey olmaz, devam edin” de', 'Orhan Bey rahatlamış görünüyor ama bulantısı sürüyor.', -3, { geri: 'Lityum toksisitesi belirtilerini görmezden gelmek ciddi sonuç doğurabilir.' })
        ] },
        K('Ne yaparsın?', 'Orhan Bey: “Ağrım için ne kullanayım?”', [
          ['Hekimle görüşüp naproksenin kesilmesini ve lityum düzeyinin bugün ölçülmesini sağlarım; ağrı için parasetamol öneririm', true, 'Doğru. Etkileşimi kesmek, düzeyi ölçmek ve güvenli alternatif sunmak gerekir.'],
          ['Naproksene devam, bol su için', false, 'Sıvı yeterli değil; etkileşim sürdükçe düzey yükselir.'],
          ['Lityumu bugünden bırakın', false, 'Lityumu kendi başına bırakmak relaps riski taşır; karar hekimindir.']
        ]),
        MASA('Vaka masasında kontrolleri seç, ilaçla ilgili sorunu belirle ve müdahaleni yaz.')
      ] },

    /* ------------------------------ Adrenalin oto-enjektörü ------------------------------ */
    { id: 'ecz-anafilaksi', vaka: 'anafilaksi', lab: 'eczacilik', oda: ODA, odaAd: ODAAD, baslik: 'Arı sokması sonrası taburculuk',
      hasta: { ad: 'Barış', hitap: 'Barış Bey', yas: 33, cins: 'E', gorunum: 'yetiskin', poz: 'ayakta' }, mentor: ECZ,
      adimlar: [
        { tip: 'konus', kim: 'hasta', metin: 'Dün arı soktu, acile kaldırdılar. Bu kalemleri yazdılar ama nasıl kullanılacağını bilmiyorum.' },
        { tip: 'sor', baslik: 'Görüşme', hak: 3, yonerge: 'en önemli soruları seç', secenek: [
          S('tepki', 'Dün neler yaşadınız?', 'Boğazım daraldı, nefes alamadım, bayılacak gibi oldum.', 3, 'Tepki|Anafilaksi.'),
          S('tasima', 'Kalemi nerede taşımayı düşünüyorsunuz?', 'Arabanın torpidosunda dururdu.', 3, 'Taşıma|Torpidoda (sıcak).'),
          S('ilac', 'Düzenli ilaç kullanıyor musunuz?', 'Hayır.', 1, 'İlaç|Yok.'),
          S('arac', 'Hangi arabayı kullanıyorsunuz?', 'Eski bir hatchback.', 0),
          YARGI('hasta', 'Arıların olduğu yerde ne işiniz vardı?', 'Bahçede çalışıyordum…')
        ] },
        { tip: 'eylem', baslik: 'Eğitim', yonerge: 'gerekenleri yap', secenek: [
          E('goster', 'Eğitim kalemiyle uygulamayı göster, geri göstert', 'Barış Bey ikinci denemede doğru yaptı.', 3),
          E('skt', 'Son kullanma tarihini ve saklama koşulunu anlat', '15–25 °C, ışıktan uzak; torpidoda tutulmaz.', 2),
          E('brosur', 'Yalnız broşürü verip gönder', 'Barış Bey broşüre bakıp cebine koydu.', -2, { geri: 'Acil anda broşür okunmaz; göster-geri göster gerekir.' })
        ] },
        K('Uygulama yeri?', 'Barış Bey: “Kalemi nereye batıracağım?”', [
          ['Uyluğun dış yüzüne, gerekirse giysinin üzerinden; sonra 112’yi arayın', true, 'Doğru. Uyluk dış yüzü önerilen bölgedir; uygulamadan sonra mutlaka acil yardım çağrılır.'],
          ['Kalçaya, kas içine', false, 'Kalça yağ dokusu kalın olabilir, emilim gecikir; önerilen bölge uyluk dış yüzüdür.'],
          ['Koldaki damara', false, 'Oto-enjektör damar içine uygulanmaz.']
        ]),
        MASA('Vaka masasında kontrolleri seç, eğitim ihtiyacını belirle ve danışmanlığını yaz.')
      ] }
  ];
});
