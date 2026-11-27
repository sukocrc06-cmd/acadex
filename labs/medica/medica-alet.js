/* ==========================================================================
   ACADEX MEDICA · alet dolabı (labs/medica/medica-alet.js), 27.11.2026
   Muayene aletlerini tanıtan panel: her alet için çizim (parçalar numaralı), ne işe yarar,
   nasıl kullanılır (adım adım), dikkat / sık hatalar, hangi muayenede. "Kendini dene" kısa sınavı
   (çizimden aleti tanı + durumdan aleti seç). Görülen aletler ve en iyi sınav puanı cihazda saklanır.
   Üst çubuktaki "Aletler" düğmesi açar (#md-alet). Eğitim amaçlıdır; klinik uygulamada kurum
   protokolü ve eğitmen gözetimi esastır.
     AXALET.ac(id?)   paneli açar (id verilirse o aletin kartı)
     AXALET.ALET      veri (testler için)
   ========================================================================== */
(function () {
  'use strict';
  var D = document, W = window;
  var X = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var RM = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var ls = {
    get: function (k, d) { try { var v = localStorage.getItem('acadex.medica.alet.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('acadex.medica.alet.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  var INK = '#2E3A5C', MET = '#C9D1DC', METK = '#8D98A8';

  /* ---------------- çizimler (viewBox 0 0 240 160) ---------------- */
  var CIZ = {
    steteskop: '<path d="M70 22 C68 64 96 80 120 80 C144 80 172 64 170 22" stroke="' + INK + '" stroke-width="6" fill="none" stroke-linecap="round"/>' +
      '<path d="M70 22 l-6 -8 M170 22 l6 -8" stroke="' + METK + '" stroke-width="5" stroke-linecap="round"/><ellipse cx="62" cy="12" rx="7" ry="6" fill="#1D2438"/><ellipse cx="178" cy="12" rx="7" ry="6" fill="#1D2438"/>' +
      '<path d="M84 52 h72" stroke="' + METK + '" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M120 80 C120 104 136 118 160 122" stroke="#2F4A7A" stroke-width="8" fill="none" stroke-linecap="round"/>' +
      '<g><rect x="156" y="114" width="12" height="16" rx="3" fill="' + METK + '"/><circle cx="186" cy="128" r="22" fill="' + MET + '" stroke="#6E7A90" stroke-width="3"/><circle cx="186" cy="128" r="15" fill="#EEF2F7" stroke="#B5C0CF" stroke-width="2"/><path d="M178 121 a10 10 0 0 1 12 -3" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<path d="M150 128 a9 9 0 1 0 0 1" fill="' + MET + '" stroke="#6E7A90" stroke-width="2.5"/><circle cx="142" cy="130" r="9" fill="' + MET + '" stroke="#6E7A90" stroke-width="2.5"/><circle cx="142" cy="130" r="4" fill="#6E7A90"/></g>',
    tansiyon: '<rect x="18" y="58" width="96" height="62" rx="10" fill="#2F6BFF"/><rect x="18" y="58" width="96" height="16" rx="8" fill="#5A8BFF"/><path d="M30 84 h72 M30 96 h72 M30 108 h72" stroke="#1F4FCC" stroke-width="2" stroke-dasharray="4 5"/><rect x="58" y="66" width="20" height="8" rx="2" fill="#fff" opacity=".85"/><path d="M62 70 l6 -3 l6 3" stroke="#2F6BFF" stroke-width="1.4" fill="none"/>' +
      '<path d="M78 120 C80 142 120 146 136 126" stroke="#1D2438" stroke-width="4" fill="none"/><path d="M52 120 C52 150 110 156 150 140" stroke="#1D2438" stroke-width="4" fill="none"/>' +
      '<circle cx="176" cy="56" r="38" fill="#fff" stroke="' + INK + '" stroke-width="5"/>' +
      (function () { var s = ''; for (var i = 0; i <= 15; i++) { var a = (-225 + i * 18) * Math.PI / 180, r1 = 30, r2 = i % 5 === 0 ? 22 : 26; s += '<path d="M' + (176 + Math.cos(a) * r1).toFixed(1) + ' ' + (56 + Math.sin(a) * r1).toFixed(1) + ' L' + (176 + Math.cos(a) * r2).toFixed(1) + ' ' + (56 + Math.sin(a) * r2).toFixed(1) + '" stroke="' + INK + '" stroke-width="' + (i % 5 === 0 ? 2.4 : 1.4) + '"/>'; } return s; })() +
      '<path d="M176 56 L196 42" stroke="#E5544A" stroke-width="3" stroke-linecap="round"/><circle cx="176" cy="56" r="4" fill="' + INK + '"/><text x="176" y="80" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="8" fill="' + INK + '">mmHg</text>' +
      '<path d="M176 94 v14 C176 122 160 128 150 140" stroke="#1D2438" stroke-width="4" fill="none"/>' +
      '<rect x="138" y="132" width="16" height="12" rx="3" fill="' + METK + '"/><circle cx="146" cy="138" r="3" fill="#fff"/><ellipse cx="124" cy="142" rx="20" ry="15" fill="#1D2438"/><path d="M112 136 q10 -6 22 -2" stroke="#fff" stroke-width="2.5" fill="none" opacity=".3" stroke-linecap="round"/>',
    otoskop: '<rect x="96" y="66" width="34" height="86" rx="10" fill="#2F4A7A"/><path d="M102 80 h22 M102 90 h22 M102 100 h22 M102 110 h22 M102 120 h22" stroke="#4C6BA0" stroke-width="3"/><rect x="92" y="60" width="42" height="14" rx="5" fill="' + INK + '"/>' +
      '<rect x="86" y="18" width="54" height="44" rx="12" fill="#3B4A6A"/><circle cx="113" cy="40" r="13" fill="#9FD8F0" stroke="#fff" stroke-width="3"/><path d="M106 34 a8 8 0 0 1 9 -3" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
      '<path d="M140 30 L196 36 L196 44 L140 50 Z" fill="#1D2438"/><path d="M196 36 L210 38.5 L210 41.5 L196 44 Z" fill="#11182A"/><path d="M146 34 L188 38" stroke="#fff" stroke-width="2" opacity=".3"/>' +
      '<path d="M210 40 h14" stroke="#FFE27A" stroke-width="3" stroke-linecap="round" stroke-dasharray="3 3"/><rect x="128" y="96" width="10" height="16" rx="3" fill="' + METK + '"/>',
    oftalmoskop: '<rect x="100" y="70" width="34" height="84" rx="10" fill="#2F4A7A"/><path d="M106 84 h22 M106 94 h22 M106 104 h22 M106 114 h22" stroke="#4C6BA0" stroke-width="3"/><rect x="96" y="64" width="42" height="12" rx="5" fill="' + INK + '"/>' +
      '<rect x="90" y="8" width="54" height="60" rx="14" fill="#3B4A6A"/><circle cx="117" cy="30" r="7" fill="#11182A" stroke="#9AA6BC" stroke-width="2"/><circle cx="117" cy="30" r="2.4" fill="#9FD8F0"/>' +
      '<circle cx="117" cy="54" r="11" fill="' + MET + '" stroke="#6E7A90" stroke-width="2"/><text x="117" y="58" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9" font-weight="700" fill="' + INK + '">+2</text>' +
      '<path d="M144 26 h20" stroke="#FFE27A" stroke-width="3" stroke-linecap="round" stroke-dasharray="3 3"/><rect x="132" y="98" width="9" height="14" rx="3" fill="' + METK + '"/>',
    cekic: '<path d="M60 40 L150 40 L105 92 Z" fill="#E5544A" stroke="#B43A31" stroke-width="3" stroke-linejoin="round"/><path d="M78 46 L132 46" stroke="#fff" stroke-width="3" opacity=".35" stroke-linecap="round"/>' +
      '<rect x="99" y="34" width="12" height="16" rx="3" fill="' + METK + '"/><path d="M105 92 L118 152" stroke="' + METK + '" stroke-width="8" stroke-linecap="round"/><path d="M104 96 L116 150" stroke="#fff" stroke-width="2" opacity=".45"/><circle cx="119" cy="152" r="7" fill="' + MET + '" stroke="#6E7A90" stroke-width="2"/>',
    termometre: '<rect x="40" y="62" width="160" height="40" rx="20" fill="#fff" stroke="#9AA6BC" stroke-width="3"/><path d="M200 74 L226 80 a4 4 0 0 1 0 4 L200 90 Z" fill="' + MET + '" stroke="#6E7A90" stroke-width="2.5"/>' +
      '<rect x="78" y="70" width="70" height="24" rx="5" fill="#1D2438"/><text x="113" y="88" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="16" font-weight="700" fill="#7FE0C2">36,8°</text>' +
      '<circle cx="58" cy="82" r="8" fill="#2E9C86"/><path d="M164 74 v16" stroke="#C9D1DC" stroke-width="3" stroke-linecap="round"/><path d="M50 66 h120" stroke="#fff" stroke-width="3" opacity=".7"/>',
    oksimetre: '<path d="M120 112 C96 112 70 106 30 104 a12 12 0 0 1 0 -24 C70 78 96 72 120 72" fill="#EDBB98" stroke="#C99572" stroke-width="2"/><path d="M34 86 q-8 6 0 12" stroke="#C99572" stroke-width="2" fill="none"/>' +
      '<rect x="60" y="44" width="110" height="38" rx="14" fill="#2F6BFF"/><rect x="60" y="100" width="110" height="34" rx="14" fill="#1F4FCC"/><path d="M160 82 q14 10 0 18" stroke="' + INK + '" stroke-width="5" fill="none"/>' +
      '<rect x="74" y="50" width="70" height="26" rx="5" fill="#0B1222"/><text x="82" y="68" font-family="JetBrains Mono,monospace" font-size="13" font-weight="700" fill="#66C7FF">98%</text><text x="118" y="68" font-family="JetBrains Mono,monospace" font-size="11" font-weight="700" fill="#4BE08A">72</text>' +
      '<path d="M78 74 q4 -6 8 0 t8 0 t8 0 t8 0 t8 0 t8 0" stroke="#66C7FF" stroke-width="1.2" fill="none"/><circle cx="96" cy="118" r="5" fill="#FF6B5A" opacity=".85"/><circle cx="96" cy="118" r="10" fill="#FF6B5A" opacity=".2"/>',
    abeslang: '<rect x="20" y="70" width="140" height="22" rx="11" fill="#E9CFA0" stroke="#C9A86E" stroke-width="2.5"/><path d="M34 76 C70 74 110 74 146 78 M34 86 C80 84 110 85 146 86" stroke="#D2B27A" stroke-width="1.5" fill="none"/>' +
      '<rect x="168" y="20" width="16" height="96" rx="7" fill="#2F4A7A" transform="rotate(28 176 68)"/><rect x="172" y="10" width="8" height="12" rx="2" fill="' + METK + '" transform="rotate(28 176 68)"/><circle cx="200" cy="25" r="5" fill="#FFE27A"/><path d="M204 20 l14 -10 M207 26 l17 -2 M204 31 l14 8" stroke="#FFE27A" stroke-width="2.5" stroke-linecap="round"/>'
  };

  /* ---------------- veri ---------------- */
  var ALET = [
    { id: 'steteskop', ad: 'Steteskop', kisa: 'Kalp, akciğer ve bağırsak seslerini dinler.', renk: '#2E9C86',
      parca: [['Olivler (kulaklıklar)', 62, 12], ['Kulak boruları', 96, 56], ['Hortum', 132, 104], ['Diyafram', 186, 128], ['Çan', 142, 130]],
      ne: 'Oskültasyon aleti. Diyafram yüksek frekanslı sesleri (S1–S2, solunum sesleri, bağırsak sesleri), çan düşük frekanslı sesleri (S3, S4, mitral darlığın düşük perdeli üfürümü) daha iyi iletir.',
      adim: ['Olivleri kulak yolunun yönüne uygun olarak hafifçe öne bakacak şekilde tak.', 'Göğüs parçasını avucunda ısıt; sessiz bir ortamda, doğrudan cilde koy (kıyafetin üstünden dinleme).', 'Diyaframı cilde sıkıca bastır; çanı ise cilde yalnızca hafifçe değdir (bastırırsan çan diyafram gibi davranır).', 'Kalpte aort, pulmoner, triküspit ve mitral odakları sırayla; akciğerde iki tarafı simetrik ve karşılaştırarak dinle.', 'Her hastadan sonra göğüs parçasını ve olivleri alkollü mendille sil.'],
      dikkat: ['Kıyafet üzerinden dinlemek sürtünme sesi yaratır.', 'Olivleri ters takmak sesi neredeyse keser.', 'Hortumun bir yere sürtünmesi yalancı ses verir.'],
      nerede: ['Kardiyovasküler muayene', 'Solunum sistemi muayenesi', 'Batın muayenesi', 'Tansiyon ölçümü'] },
    { id: 'tansiyon', ad: 'Tansiyon aleti', kisa: 'Kan basıncını ölçer (sfigmomanometre).', renk: '#2F6BFF',
      parca: [['Manşet', 66, 90], ['Manometre', 176, 56], ['Hortumlar', 70, 147], ['Puar (pompa)', 124, 142], ['Vana', 146, 138]],
      ne: 'Manşet kolu sıkıştırır, manometre basıncı gösterir. Basınç yavaşça indirilirken dirsek çukurunda steteskopla Korotkoff sesleri dinlenir: ilk duyulan ses sistolik, seslerin kaybolduğu nokta diyastolik basınçtır.',
      adim: ['Hasta ölçümden önce en az 5 dakika dinlensin; sırtı destekli otursun, bacak bacak üstüne atmasın, konuşmasın.', 'Kolun çevresine uygun manşet seç; manşet kolu kalp hizasında ve destekli olsun.', 'Manşetin alt kenarı dirsek çukurunun 2–3 cm üstünde kalacak şekilde sıkıca sar.', 'Radiyal nabzı ellerken şişir; nabzın kaybolduğu basıncın 20–30 mmHg üstüne çık.', 'Steteskobu brakiyal arterin üstüne koy; vanayı açarak basıncı saniyede 2–3 mmHg düşür.', 'İlk sesi sistolik, seslerin tamamen kaybolduğu noktayı diyastolik olarak kaydet; ilk ölçümde iki kolu da ölç.'],
      dikkat: ['Kola göre küçük manşet değeri yüksek, büyük manşet düşük gösterir.', 'Basıncı hızlı indirmek değeri olduğundan düşük okutur.', 'Kol kalp hizasının altındaysa değer yüksek çıkar.'],
      nerede: ['Vital bulgular', 'Kardiyovasküler muayene', 'Ortostatik hipotansiyon testi'] },
    { id: 'otoskop', ad: 'Otoskop', kisa: 'Dış kulak yolunu ve kulak zarını aydınlatıp büyütür.', renk: '#C98A1E',
      parca: [['Spekulum (kulak hunisi)', 200, 40], ['Büyüteç penceresi', 113, 40], ['Işık başlığı', 98, 24], ['Sap (pil)', 113, 124], ['Açma düğmesi', 133, 104]],
      ne: 'Işıklı ve büyüteçli kulak muayene aleti. Dış kulak yolu (kızarıklık, buşon, akıntı) ve kulak zarı (renk, ışık refleksi, malleus sapı, perforasyon, sıvı seviyesi) değerlendirilir.',
      adim: ['Kulak yoluna uyan en büyük spekulumu tak; her hastada temiz ya da tek kullanımlık spekulum kullan.', 'Önce kulak kepçesine ve çevresine bak, tragusa bastırıp ağrı var mı sor.', 'Yetişkinde kulak kepçesini yukarı ve arkaya, küçük çocukta aşağı ve arkaya çekerek kulak yolunu düzleştir.', 'Otoskobu kalem gibi tut, elinin kenarını hastanın başına daya (hasta kıpırdarsa alet de onunla hareket eder).', 'Spekulumu yavaşça ilerlet; kulak zarında ışık konisini (ön alt kadran) ve malleus sapını bul.'],
      dikkat: ['Spekulumu derine itmek ağrı ve yaralanma yapar.', 'Eli hastaya dayamadan bakmak, ani harekette kulak yolunu yaralayabilir.', 'Buşon varsa zar görülmez; temizlenmeden yorum yapma.'],
      nerede: ['Kulak burun boğaz muayenesi', 'Çocuk muayenesi', 'Odyolojik değerlendirme öncesi'] },
    { id: 'oftalmoskop', ad: 'Oftalmoskop', kisa: 'Göz dibini (retina, optik disk) gösterir.', renk: '#7A4BD8',
      parca: [['Gözetleme deliği', 117, 30], ['Lens çarkı (diyoptri)', 117, 54], ['Işık', 160, 26], ['Sap (pil)', 117, 124]],
      ne: 'Direkt oftalmoskop ile kırmızı refleks, optik disk (sınır, renk, çukurluk), retina damarları ve makula değerlendirilir. Papil ödemi, diyabetik ve hipertansif retina değişiklikleri buradan görülür.',
      adim: ['Odayı karart; hasta uzakta sabit bir noktaya baksın.', 'Hastanın sağ gözüne sağ elinle ve sağ gözünle, sol gözüne sol elinle ve sol gözünle bak.', 'Yaklaşık bir kol boyu uzaktan kırmızı refleksi gör; iki gözü karşılaştır.', 'Yaklaşık 15° yandan (temporalden) yaklaş; lens çarkıyla netleştir.', 'Optik diski bul, damarları dört kadranda izle; makulaya en son bak (ışığa en duyarlı yer).'],
      dikkat: ['Çocukta kırmızı refleksin olmaması ya da beyaz görünmesi acil göz değerlendirmesi gerektirir.', 'Çok parlak ışık hastayı rahatsız eder, pupilla küçülür ve görüş daralır.', 'Göz damlası ile pupilla genişletme hekim kararıdır.'],
      nerede: ['Nörolojik muayene', 'Göz muayenesi', 'Diyabet ve hipertansiyon takibi'] },
    { id: 'cekic', ad: 'Refleks çekici', kisa: 'Derin tendon reflekslerini değerlendirir.', renk: '#C9483B',
      parca: [['Lastik başlık', 105, 58], ['Metal sap', 112, 124]],
      ne: 'Tendona yapılan hızlı vuruşla kas gerilir ve refleks kasılma gözlenir. Biseps (C5–C6), triseps (C7), patella (L2–L4) ve Aşil (S1) refleksleri en sık bakılanlardır. Yanıt 0 (yok) ile 4+ (klonus) arasında derecelendirilir.',
      adim: ['Hastayı rahatlat; kas gevşek ve hafif gerili pozisyonda olsun (ör. diz bükülü ve sarkık).', 'Çekici sapın ucundan gevşek tut; bileğinden sarkaç gibi serbest bırakarak vur.', 'Tendona tek ve kararlı vuruş yap; kasılmayı gözle ve elle hisset.', 'Her refleksi iki tarafta karşılaştır; asimetri tek başına önemli bir bulgudur.', 'Yanıt alamazsan Jendrassik manevrası (hastanın ellerini kenetleyip çekmesi) ile güçlendir.'],
      dikkat: ['Bileği kilitli vurmak yanıtı zayıflatır.', 'Tek tarafa bakmak asimetriyi kaçırır.', 'Gergin kas refleksi baskılar; hastayı rahatlatmadan değerlendirme.'],
      nerede: ['Nörolojik muayene', 'Bel ve boyun ağrısı değerlendirmesi', 'Fizyoterapi değerlendirmesi'] },
    { id: 'termometre', ad: 'Termometre', kisa: 'Vücut sıcaklığını ölçer.', renk: '#2E8E5B',
      parca: [['Ölçüm ucu', 214, 82], ['Ekran', 113, 82], ['Açma düğmesi', 58, 82]],
      ne: 'Vücut sıcaklığı koltuk altı, ağız, kulak (timpanik), alın ya da rektal yoldan ölçülür. Değer ölçüm yerine göre değişir: koltuk altı genellikle en düşük, rektal en yüksek okur. Ateş çoğunlukla 38,0 °C ve üzeri olarak kabul edilir.',
      adim: ['Ölçüm yerini hastaya ve yaşa göre seç; her hastada temiz uç ya da yeni kılıf kullan.', 'Ağızdan ölçüm için hasta son 15–30 dakikada sıcak ya da soğuk bir şey içmemiş olsun.', 'Koltuk altında ucu tepe noktasına yerleştir, kolu gövdeye yapıştır; koltuk altı kuru olsun.', 'Kulaktan ölçerken yetişkinde kulak kepçesini yukarı ve arkaya çek, ucu kulak yoluna yerleştir.', 'Sinyal sesini bekle; değeri ve ölçüm yerini birlikte kaydet.'],
      dikkat: ['Islak koltuk altı düşük okur.', 'Ölçüm yerini yazmamak takibi yanıltır.', 'Kılıfı değiştirmemek enfeksiyon taşır.'],
      nerede: ['Vital bulgular', 'Ateşli hasta değerlendirmesi', 'Çocuk muayenesi'] },
    { id: 'oksimetre', ad: 'Pulse oksimetre', kisa: 'Oksijen satürasyonunu (SpO₂) ve nabzı gösterir.', renk: '#126E7A',
      parca: [['Ekran (SpO₂ ve nabız)', 108, 62], ['Pleth dalgası', 120, 74], ['Işık kaynağı', 96, 118], ['Parmak yuvası', 140, 92]],
      ne: 'Kırmızı ve kızılötesi ışığın parmaktan geçişini ölçerek hemoglobinin oksijenle doygunluğunu yüzde olarak tahmin eder. Sağlıklı yetişkinde genellikle %95–100 arasıdır.',
      adim: ['Parmak sıcak ve temiz olsun; oje ya da takma tırnak varsa çıkar ya da başka parmak seç.', 'Cihazı parmağın ucuna, tırnak üste gelecek şekilde tak.', 'Hasta elini kalp hizasında ve hareketsiz tutsun.', 'Dalga düzgün ve düzenli olana kadar birkaç saniye bekle; sonra değeri oku.', 'Değeri hastanın genel durumu ve solunum sayısıyla birlikte yorumla.'],
      dikkat: ['Soğuk el, titreme ve hareket yanlış okumaya yol açar.', 'Karbonmonoksit zehirlenmesinde değer yanıltıcı biçimde normal görünebilir.', 'Ten rengi koyu kişilerde gerçek değerden biraz yüksek okuyabileceği bildirilmiştir; şüphede kan gazı istenir.'],
      nerede: ['Vital bulgular', 'Solunum sıkıntısı', 'Ameliyat ve sedasyon izlemi'] },
    { id: 'abeslang', ad: 'Dil basacağı ve kalem fener', kisa: 'Ağız ve boğazı görmeyi, pupilla refleksini sağlar.', renk: '#B45A12',
      parca: [['Dil basacağı (abeslang)', 70, 81], ['Kalem fener', 186, 66], ['Işık', 204, 25]],
      ne: 'Dil basacağı dili aşağı iterek tonsiller, uvula ve farenks arka duvarının görülmesini sağlar. Kalem fener ağız içini aydınlatır ve pupillaların ışığa yanıtını (direkt ve indirekt) değerlendirmekte kullanılır.',
      adim: ['Tek kullanımlık dil basacağı kullan; hastadan ağzını açıp "aaa" demesini iste.', 'Basacağı dilin ön üçte ikisine yerleştir, nazikçe aşağı bastır (arka üçte biri öğürme refleksini tetikler).', 'Feneri ağız içine tut; tonsiller, uvulanın orta hatta olup olmadığı ve farenks arka duvarına bak.', 'Pupilla için ortamı karart; ışığı yandan bir göze getir, aynı gözde (direkt) ve diğer gözde (indirekt) küçülmeyi izle.'],
      dikkat: ['Dilin arkasına bastırmak öğürmeye yol açar.', 'Uvulanın bir yana itilmiş olması peritonsiller apse gibi durumlarda görülebilir; hekime bildir.', 'Işığı doğrudan önden tutmak yakın bakış yanıtını karıştırır.'],
      nerede: ['Kulak burun boğaz muayenesi', 'Nörolojik muayene', 'Çocuk muayenesi'] }
  ];
  /* durumdan aleti seç soruları */
  var DURUM = [
    ['Korotkoff seslerini dinleyerek kan basıncını ölçeceksin. Manşetin yanında hangi alete daha ihtiyacın var?', 'steteskop'],
    ['Ateşi olan çocukta kulak zarındaki kızarıklığa ve sıvı seviyesine bakmak istiyorsun.', 'otoskop'],
    ['Baş ağrısı olan hastada papil ödemi var mı diye göz dibine bakacaksın.', 'oftalmoskop'],
    ['Bel fıtığı düşünülen hastada Aşil refleksini iki tarafta karşılaştıracaksın.', 'cekic'],
    ['Nefes darlığı olan hastanın oksijen doygunluğunu hızla öğrenmek istiyorsun.', 'oksimetre'],
    ['Boğaz ağrısı olan hastada tonsillere ve uvulaya bakacaksın.', 'abeslang'],
    ['Hastanın akciğerlerinde iki tarafı karşılaştırarak solunum seslerini dinleyeceksin.', 'steteskop'],
    ['Ortostatik hipotansiyon için yatarken ve ayakta ölçüm yapacaksın.', 'tansiyon'],
    ['Titreme ve halsizlikle gelen hastada ateşi doğrulamak istiyorsun.', 'termometre']
  ];
  var bul = function (id) { return ALET.filter(function (a) { return a.id === id; })[0]; };

  /* ---------------- görünüm ---------------- */
  var CSS = [
    '.mal{position:fixed;inset:0;z-index:120;display:flex;align-items:stretch;justify-content:center;background:rgba(13,24,56,.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);padding:18px;animation:mal-in .3s ease both}',
    '@keyframes mal-in{from{opacity:0}}',
    'body.mal-acik .asz-fab{display:none}',
    '.mal-k{position:relative;display:flex;flex-direction:column;width:min(1180px,100%);max-height:100%;border-radius:20px;background:#F6F8FA;box-shadow:0 30px 80px -30px rgba(0,0,0,.6);overflow:hidden}',
    '.mal-u{display:flex;align-items:center;gap:12px;padding:14px 18px;background:#fff;border-bottom:1px solid #DCE2EA}',
    '.mal-u h2{margin:0;font:800 20px "Bricolage Grotesque","Instrument Sans",sans-serif}.mal-u small{display:block;color:#6A7593;font-size:12.5px;font-weight:500}',
    '.mal-u .sag{margin-left:auto;display:flex;gap:8px}',
    '.mal-b{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 14px;border:1.5px solid #0D1838;border-radius:999px;background:#fff;color:#0D1838;font-weight:700;font-size:14px;cursor:pointer}',
    'a.mal-b{text-decoration:none}',
    '.mal-b.pri{background:#0D1838;color:#fff}.mal-b:disabled{opacity:.4;cursor:default}',
    '.mal-x{width:40px;height:40px;border:0;border-radius:12px;background:#EEF2F5;font-size:20px;cursor:pointer;color:#0D1838}',
    '.mal-g{flex:1;overflow:auto;padding:18px;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;align-content:start}',
    '.mal-c{position:relative;display:flex;flex-direction:column;align-items:stretch;text-align:left;padding:12px 14px 14px;border:1.5px solid #DCE2EA;border-radius:16px;background:#fff;cursor:pointer;transition:transform .2s,box-shadow .2s,border-color .2s;font:inherit;color:#0D1838}',
    '.mal-c:hover,.mal-c:focus-visible{transform:translateY(-3px);border-color:var(--ac);box-shadow:0 18px 30px -22px rgba(13,24,56,.6);outline:none}',
    '.mal-c svg{width:100%;height:auto;aspect-ratio:3/2;border-radius:12px;background:linear-gradient(160deg,#F3F6F9,#E6ECF2)}',
    '.mal-c b{margin-top:10px;font-size:16px}.mal-c span{font-size:13px;color:#46506A;line-height:1.4;margin-top:2px}',
    '.mal-c i{position:absolute;top:18px;right:20px;font-style:normal;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:#E2F4EF;color:#2E8E5B}',
    '.mal-d{flex:1;overflow:auto;padding:18px;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:18px;align-content:start}',
    '.mal-res{position:relative;border-radius:18px;background:linear-gradient(160deg,#FFFFFF,#E9EEF4);border:1px solid #DCE2EA;padding:10px}',
    '.mal-res svg{display:block;width:100%;height:auto}',
    '.mal-res .p circle{fill:var(--ac);stroke:#fff;stroke-width:2}.mal-res .p text{font:700 8px "JetBrains Mono",monospace;fill:#fff;text-anchor:middle;dominant-baseline:central}',
    '.mal-res .p{cursor:pointer}.mal-res .p.on circle{r:9;fill:#0D1838}',
    '.mal-res .p{animation:mal-p .5s ease both}',
    '@keyframes mal-p{from{opacity:0;transform:scale(.4)}}',
    '.mal-pl{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px}',
    '.mal-pl li button{display:inline-flex;align-items:center;gap:6px;border:1.5px solid #DCE2EA;background:#fff;border-radius:999px;padding:5px 11px 5px 6px;font:600 13px "Instrument Sans",sans-serif;color:#0D1838;cursor:pointer}',
    '.mal-pl li button b{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--ac);color:#fff;font:700 11px "JetBrains Mono",monospace}',
    '.mal-pl li button[aria-pressed=true]{border-color:#0D1838;background:#0D1838;color:#fff}',
    '.mal-m h3{margin:0;font:800 26px "Bricolage Grotesque","Instrument Sans",sans-serif}.mal-m .ks{margin:4px 0 12px;color:#46506A}',
    '.mal-m section{margin:0 0 14px;padding:14px 16px;border-radius:14px;background:#fff;border:1px solid #DCE2EA}',
    '.mal-m h4{margin:0 0 8px;font:700 11px "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--ac)}',
    '.mal-m p{margin:0;font-size:14.5px;line-height:1.55}',
    '.mal-m ol{margin:0;padding-left:20px}.mal-m ol li{margin:0 0 7px;font-size:14.5px;line-height:1.5}',
    '.mal-m ul{margin:0;padding-left:18px}.mal-m ul li{margin:0 0 6px;font-size:14px;line-height:1.45}',
    '.mal-m .dk{background:#FFF6E8;border-color:#F2D7A6}.mal-m .dk h4{color:#B45A12}',
    '.mal-tg{display:flex;flex-wrap:wrap;gap:6px}.mal-tg span{padding:4px 10px;border-radius:999px;background:#EEF2F5;font-size:12.5px;font-weight:600}',
    '.mal-ak{display:flex;gap:8px;margin-top:6px;flex-wrap:wrap}',
    '.mal-q{flex:1;overflow:auto;padding:22px 18px;display:flex;flex-direction:column;align-items:center}',
    '.mal-q .soru{width:min(680px,100%)}.mal-q .ilerle{height:6px;border-radius:4px;background:#DCE2EA;overflow:hidden;margin-bottom:14px}.mal-q .ilerle i{display:block;height:100%;background:#2E9C86;transition:width .3s}',
    '.mal-q h3{margin:0 0 12px;font:700 19px "Instrument Sans",sans-serif;line-height:1.4}',
    '.mal-q .res{border-radius:16px;background:#fff;border:1px solid #DCE2EA;padding:8px;margin-bottom:14px}.mal-q .res svg{display:block;width:100%;max-height:240px}',
    '.mal-q .sec{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '.mal-q .sec button{min-height:52px;padding:8px 14px;border:1.5px solid #DCE2EA;border-radius:14px;background:#fff;font:600 15px "Instrument Sans",sans-serif;color:#0D1838;cursor:pointer;text-align:left}',
    '.mal-q .sec button:hover{border-color:#0D1838}.mal-q .sec button.ok{background:#E2F4EF;border-color:#2E8E5B}.mal-q .sec button.no{background:#FDECEA;border-color:#C9483B}',
    '.mal-q .geri{margin-top:12px;padding:12px 14px;border-radius:12px;background:#fff;border:1px solid #DCE2EA;font-size:14px;line-height:1.5}',
    '.mal-q .son{text-align:center}.mal-q .son b{display:block;font:800 54px "Bricolage Grotesque",sans-serif}',
    '@media (max-width:760px){.mal{padding:0}.mal-k{border-radius:0}.mal-d{grid-template-columns:1fr}.mal-q .sec{grid-template-columns:1fr}.mal-u h2{font-size:17px}.mal-u .sag .mal-b span{display:none}}',
    '@media (prefers-reduced-motion:reduce){.mal,.mal-res .p{animation:none}.mal-c{transition:none}}'
  ].join('\n');
  var cssOk = false;
  var cssEkle = function () { if (cssOk) return; cssOk = true; var st = D.createElement('style'); st.textContent = CSS; D.head.appendChild(st); };
  var svg = function (a, parcali, sec) {
    var s = '<svg viewBox="0 0 240 160" role="img" aria-label="' + X(a.ad) + ' çizimi">' + CIZ[a.id];
    if (parcali) a.parca.forEach(function (p, i) { s += '<g class="p' + (sec === i ? ' on' : '') + '" data-p="' + i + '" style="animation-delay:' + (RM ? 0 : 0.15 + i * 0.08) + 's;transform-origin:' + p[1] + 'px ' + p[2] + 'px"><circle cx="' + p[1] + '" cy="' + p[2] + '" r="7.5"/><text x="' + p[1] + '" y="' + p[2] + '">' + (i + 1) + '</text></g>'; });
    return s + '</svg>';
  };
  var oku = function (t) {
    if (!W.speechSynthesis || !W.SpeechSynthesisUtterance) return false;
    try { W.speechSynthesis.cancel(); var u = new W.SpeechSynthesisUtterance(t); u.lang = 'tr-TR'; var vs = W.speechSynthesis.getVoices().filter(function (v) { return /^tr/i.test(v.lang); }); if (vs.length) u.voice = vs.sort(function (a, b) { return (/natural|online/i.test(b.name) ? 1 : 0) - (/natural|online/i.test(a.name) ? 1 : 0); })[0]; W.speechSynthesis.speak(u); return true; } catch (e) { return false; }
  };

  var EL = null, ONCE = null, gor = ls.get('gor', []);
  var kapat = function () { if (!EL) return; if (W.speechSynthesis) try { W.speechSynthesis.cancel(); } catch (e) {} D.removeEventListener('keydown', tus, true); EL.remove(); EL = null; D.body.classList.remove('mal-acik'); if (ONCE && ONCE.focus) try { ONCE.focus({ preventScroll: true }); } catch (e) {} };
  var tus = function (e) { if (e.key === 'Escape') { e.preventDefault(); kapat(); } };
  var govde = function (html, baslik, alt, sag) {
    EL.querySelector('.mal-u').innerHTML = '<div><h2>' + X(baslik) + '</h2><small>' + X(alt) + '</small></div><div class="sag">' + (sag || '') + '<button type="button" class="mal-x" data-a="x" aria-label="Alet dolabını kapat">×</button></div>';
    var g = EL.querySelector('.mal-ic'); g.className = 'mal-ic ' + html.cls; g.innerHTML = html.h; g.scrollTop = 0;
  };
  var liste = function () {
    govde({ cls: 'mal-g', h: ALET.map(function (a) { return '<button type="button" class="mal-c" data-ac="' + a.id + '" style="--ac:' + a.renk + '">' + svg(a) + '<b>' + X(a.ad) + '</b><span>' + X(a.kisa) + '</span>' + (gor.indexOf(a.id) >= 0 ? '<i>✓ incelendi</i>' : '') + '</button>'; }).join('') },
      'Alet dolabı · muayene aletleri', gor.length + ' / ' + ALET.length + ' alet incelendi' + (ls.get('enIyi', null) != null ? ' · sınavda en iyi ' + ls.get('enIyi') + ' / 8' : ''), '<a class="mal-b" href="../depo/index.html">Bütün bölümler: Cihaz Deposu →</a><button type="button" class="mal-b pri" data-a="sinav">Kendini dene</button>');
    setTimeout(function () { var b = EL && EL.querySelector('.mal-c'); if (b) try { b.focus({ preventScroll: true }); } catch (e) {} }, 30);
  };
  var detay = function (id, secP) {
    var a = bul(id); if (!a) return liste();
    if (gor.indexOf(id) < 0) { gor.push(id); ls.set('gor', gor); }
    var i = ALET.indexOf(a), onc = ALET[(i + ALET.length - 1) % ALET.length], son = ALET[(i + 1) % ALET.length];
    var h = '<div class="mal-sol"><div class="mal-res" style="--ac:' + a.renk + '">' + svg(a, true, secP) + '</div><ul class="mal-pl" style="--ac:' + a.renk + '">' + a.parca.map(function (p, j) { return '<li><button type="button" data-p="' + j + '" aria-pressed="' + (secP === j) + '"><b>' + (j + 1) + '</b>' + X(p[0]) + '</button></li>'; }).join('') + '</ul></div>' +
      '<div class="mal-m" style="--ac:' + a.renk + '"><h3>' + X(a.ad) + '</h3><p class="ks">' + X(a.kisa) + '</p>' +
      '<section><h4>Ne işe yarar</h4><p>' + X(a.ne) + '</p></section>' +
      '<section><h4>Nasıl kullanılır</h4><ol>' + a.adim.map(function (t) { return '<li>' + X(t) + '</li>'; }).join('') + '</ol></section>' +
      '<section class="dk"><h4>Dikkat · sık hatalar</h4><ul>' + a.dikkat.map(function (t) { return '<li>' + X(t) + '</li>'; }).join('') + '</ul></section>' +
      '<section><h4>Hangi muayenede</h4><div class="mal-tg">' + a.nerede.map(function (t) { return '<span>' + X(t) + '</span>'; }).join('') + '</div></section>' +
      '<div class="mal-ak">' + (W.speechSynthesis ? '<button type="button" class="mal-b" data-a="oku">Sesli dinle</button>' : '') + '<button type="button" class="mal-b" data-ac="' + onc.id + '">← ' + X(onc.ad) + '</button><button type="button" class="mal-b" data-ac="' + son.id + '">' + X(son.ad) + ' →</button></div></div>';
    govde({ cls: 'mal-d', h: h }, a.ad, 'Parçalara dokun: numara çizimde yanar.', '<button type="button" class="mal-b" data-a="liste">← <span>Bütün aletler</span></button>');
    EL.dataset.alet = id;
  };
  /* ---------------- sınav ---------------- */
  var karistir = function (L) { L = L.slice(); for (var i = L.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = L[i]; L[i] = L[j]; L[j] = t; } return L; };
  var SN = null;
  var sinavKur = function () {
    var tani = karistir(ALET).slice(0, 4).map(function (a) { return { tip: 'tani', dogru: a.id }; });
    var dur = karistir(DURUM).slice(0, 4).map(function (d) { return { tip: 'durum', metin: d[0], dogru: d[1] }; });
    var Q = karistir(tani.concat(dur));
    Q.forEach(function (q) { q.sec = karistir([q.dogru].concat(karistir(ALET.map(function (a) { return a.id; }).filter(function (x) { return x !== q.dogru; })).slice(0, 3))); });
    SN = { Q: Q, i: 0, d: 0 }; soru();
  };
  var soru = function () {
    var q = SN.Q[SN.i];
    if (!q) {
      var en = ls.get('enIyi', null); if (en == null || SN.d > en) ls.set('enIyi', SN.d);
      govde({ cls: 'mal-q', h: '<div class="soru son"><b>' + SN.d + ' / ' + SN.Q.length + '</b><p>' + (SN.d === SN.Q.length ? 'Hepsi doğru. Aletleri tanıyorsun.' : SN.d >= 6 ? 'Çok iyi. Kaçırdıklarının kartına bir göz at.' : 'Kartları inceleyip yeniden dene.') + '</p><div class="mal-ak" style="justify-content:center"><button type="button" class="mal-b pri" data-a="sinav">Yeniden dene</button><button type="button" class="mal-b" data-a="liste">Bütün aletler</button></div></div>' }, 'Kendini dene', 'Sonuç');
      return;
    }
    var a = bul(q.dogru);
    var h = '<div class="soru"><div class="ilerle"><i style="width:' + Math.round(SN.i / SN.Q.length * 100) + '%"></i></div>' +
      (q.tip === 'tani' ? '<h3>Bu alet hangisi?</h3><div class="res">' + svg(a) + '</div>' : '<h3>' + X(q.metin) + '</h3>') +
      '<div class="sec">' + q.sec.map(function (id) { return '<button type="button" data-cv="' + id + '">' + X(bul(id).ad) + '</button>'; }).join('') + '</div><div class="geri" hidden aria-live="polite"></div></div>';
    govde({ cls: 'mal-q', h: h }, 'Kendini dene', 'Soru ' + (SN.i + 1) + ' / ' + SN.Q.length + ' · doğru: ' + SN.d, '<button type="button" class="mal-b" data-a="liste">← <span>Bütün aletler</span></button>');
  };
  var cevap = function (id, btn) {
    var q = SN.Q[SN.i]; if (q.cevap) return; q.cevap = id; var ok = id === q.dogru; if (ok) SN.d++;
    Array.prototype.forEach.call(EL.querySelectorAll('[data-cv]'), function (b) { b.disabled = true; if (b.getAttribute('data-cv') === q.dogru) b.classList.add('ok'); });
    if (!ok) btn.classList.add('no');
    var a = bul(q.dogru), g = EL.querySelector('.geri'); g.hidden = false;
    g.innerHTML = '<b>' + (ok ? 'Doğru.' : 'Doğrusu: ' + X(a.ad) + '.') + '</b> ' + X(a.ne.split('. ')[0]) + '.<div class="mal-ak"><button type="button" class="mal-b pri" data-a="sonraki">' + (SN.i + 1 < SN.Q.length ? 'Sonraki soru' : 'Sonucu gör') + '</button></div>';
    var nb = g.querySelector('[data-a="sonraki"]'); setTimeout(function () { try { nb.focus({ preventScroll: true }); } catch (e) {} }, 30);
  };
  var tik = function (e) {
    var t = e.target;
    if (t === EL) { kapat(); return; }
    var b = t.closest('[data-a],[data-ac],[data-p],[data-cv]'); if (!b) return;
    if (b.hasAttribute('data-cv')) { cevap(b.getAttribute('data-cv'), b); return; }
    if (b.hasAttribute('data-ac')) { detay(b.getAttribute('data-ac')); return; }
    if (b.hasAttribute('data-p')) {   /* parça seçimi: yeniden çizmeden işaretle */
      var n = b.getAttribute('data-p'), al = bul(EL.dataset.alet);
      Array.prototype.forEach.call(EL.querySelectorAll('.mal-res .p'), function (g) { g.classList.toggle('on', g.getAttribute('data-p') === n); });
      Array.prototype.forEach.call(EL.querySelectorAll('.mal-pl [data-p]'), function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-p') === n ? 'true' : 'false'); });
      if (al) EL.querySelector('.mal-u small').textContent = (+n + 1) + '. ' + al.parca[+n][0];
      return;
    }
    var a = b.getAttribute('data-a');
    if (a === 'x') kapat(); else if (a === 'liste') liste(); else if (a === 'sinav') sinavKur(); else if (a === 'sonraki') { SN.i++; soru(); }
    else if (a === 'oku') { var al = bul(EL.dataset.alet); if (al) oku(al.ad + '. ' + al.ne + ' Nasıl kullanılır: ' + al.adim.join(' ')); }
  };
  var ac = function (id) {
    cssEkle(); if (EL) kapat(); ONCE = D.activeElement;
    EL = D.createElement('div'); EL.className = 'mal'; EL.setAttribute('role', 'dialog'); EL.setAttribute('aria-modal', 'true'); EL.setAttribute('aria-label', 'Alet dolabı');
    EL.innerHTML = '<div class="mal-k"><div class="mal-u"></div><div class="mal-ic"></div></div>';
    D.body.appendChild(EL); D.body.classList.add('mal-acik'); EL.addEventListener('click', tik); D.addEventListener('keydown', tus, true);
    if (id && bul(id)) detay(id); else liste();
  };
  W.AXALET = { ac: ac, kapat: kapat, ALET: ALET, DURUM: DURUM, CIZ: CIZ };
  var dugme = D.getElementById('md-alet'); if (dugme) dugme.addEventListener('click', function () { ac(); });
})();
