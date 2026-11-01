/* ==========================================================================
   ACADEX ECZACILIK LAB · veri (labs/eczacilik/ecz-veri.js), 01.11.2026
   İlaç rafı, etkileşim ağı, tezgâh reçeteleri, doz problemleri, majistral
   formüller ve Acadex Medica vaka dosyaları. Saf veri + saf hesap fonksiyonları
   (tests/eczacilik-hemsirelik.js denetler).
   EĞİTİM AMAÇLIDIR: kurgusal vakalar; tedavi önerisi değildir. Dozlar her
   problemde hekim istemi ya da prospektüs bilgisi olarak VERİLİR, öğrenci hesaplar.
   Kaynaklar: BNF / BNFc genel ilkeleri, Stockley's Drug Interactions özet bilgileri,
   ERC 2021 anafilaksi, Cockcroft ve Gault (1976), Avrupa Farmakopesi genel teknikleri.
   ========================================================================== */
(function (root, factory) {
  var V = factory();
  if (typeof module === 'object' && module.exports) module.exports = V;
  if (root) root.AXECZ = V;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';
  var V = {};

  /* ---------------- ilaç rafı ----------------
     rec: reçete türü (normal = beyaz, kirmizi = uyuşturucu, yesil = psikotrop)
     kutu: kutu rengi (rafta ayırt etme), cyp: önemli enzim ilişkisi (inh: inhibitör, ind: indükleyici, sub: substrat) */
  var I = function (id, ad, grup, form, guc, rec, kutu, mek, cyp, uyari, kullanim) { return { id: id, ad: ad, grup: grup, form: form, guc: guc, rec: rec, kutu: kutu, mek: mek, cyp: cyp, uyari: uyari, kullanim: kullanim }; };
  V.ILAC = [
    I('parasetamol', 'Parasetamol', 'Analjezik / antipiretik', 'tablet', '500 mg', 'normal', '#E7EEF7', 'Merkezî prostaglandin sentezini azaltır.', '—', 'Karaciğer hasarı: günlük en çok doz aşılmamalı; başka parasetamollü ürünlerle (soğuk algınlığı ilaçları) birlikte alınmamalı.', '4–6 saat arayla; günlük üst sınırı aşma; alkolle kullanma.'),
    I('ibuprofen', 'İbuprofen', 'NSAİİ', 'tablet', '400 mg', 'normal', '#F7D9D2', 'COX-1/COX-2 inhibisyonu.', 'CYP2C9 sub', 'Mide kanaması, böbrek işlevinde bozulma; antikoagülanla kanama riski.', 'Tok karnına, bol suyla; mide ağrısı ya da siyah dışkıda bırak.'),
    I('asa', 'Asetilsalisilik asit', 'Antiagregan', 'tablet', '100 mg', 'normal', '#F7EDCF', 'Trombosit COX-1’ini geri dönüşsüz baskılar.', '—', 'Kanama riski; çocukta Reye sendromu riski nedeniyle ateş düşürücü olarak kullanılmaz.', 'Her gün aynı saatte, tok karnına.'),
    I('amoksiklav', 'Amoksisilin + klavulanik asit', 'Penisilin grubu antibiyotik', 'tablet', '1000 mg', 'normal', '#FFF1D6', 'Hücre duvarı sentezini bozar; klavulanat beta-laktamazı baskılar.', '—', 'Penisilin alerjisinde kontrendike. İshal sık.', 'Yemeğin başında; kür bitene kadar düzenli.'),
    I('klaritromisin', 'Klaritromisin', 'Makrolid antibiyotik', 'tablet', '500 mg', 'normal', '#E1F0E6', 'Bakteriyel ribozomda protein sentezini durdurur.', 'CYP3A4 güçlü inh', 'Güçlü CYP3A4 inhibitörü: statin, amiodaron, bazı kalp ilaçlarıyla ciddi etkileşim. QT uzaması.', '12 saatte bir; kürü tamamla; ağızda metalik tat olabilir.'),
    I('siprofloksasin', 'Siprofloksasin', 'Florokinolon antibiyotik', 'tablet', '500 mg', 'normal', '#E2E8F7', 'DNA giraz inhibisyonu.', 'CYP1A2 inh', 'Kalsiyum, demir, magnezyum ve antasitlerle şelat oluşturur; tendon hasarı, güneş hassasiyeti.', 'Süt ürünleri ve antasitlerden 2 saat önce ya da 6 saat sonra; güneşten korun.'),
    I('metronidazol', 'Metronidazol', 'Antibakteriyel / antiprotozoal', 'tablet', '500 mg', 'normal', '#F1E4F5', 'Anaerop DNA’sına zarar verir.', '—', 'Alkolle disülfiram benzeri tepki (bulantı, çarpıntı, kızarma).', 'Tedavi süresince ve bittikten sonra 48 saat alkol yok.'),
    I('varfarin', 'Varfarin', 'Oral antikoagülan', 'tablet', '5 mg', 'normal', '#FCE4C7', 'K vitamini bağımlı pıhtılaşma faktörlerini azaltır.', 'CYP2C9 sub', 'Dar terapötik aralık: INR izlemi; birçok ilaç ve besinle etkileşir.', 'Her gün aynı saatte; INR randevusunu kaçırma; yeni ilaçta eczacıya sor; yeşil yapraklıyı dengeli tüket.'),
    I('klopidogrel', 'Klopidogrel', 'Antiagregan', 'tablet', '75 mg', 'normal', '#F3D9E4', 'Ön ilaç; CYP2C19 ile aktifleşir, P2Y12 reseptörünü baskılar.', 'CYP2C19 sub', 'Omeprazol aktivasyonunu azaltabilir.', 'Her gün; diş ya da ameliyat öncesi hekime söyle.'),
    I('simvastatin', 'Simvastatin', 'Statin', 'tablet', '40 mg', 'normal', '#E6E1F7', 'HMG-KoA redüktaz inhibisyonu.', 'CYP3A4 sub', 'CYP3A4 inhibitörleri ve greyfurtla kas yıkımı (miyopati, rabdomiyoliz) riski.', 'Akşam; açıklanamayan kas ağrısında hekime başvur; greyfurt suyu içme.'),
    I('atorvastatin', 'Atorvastatin', 'Statin', 'tablet', '20 mg', 'normal', '#DDE9F2', 'HMG-KoA redüktaz inhibisyonu.', 'CYP3A4 sub', 'Kas ağrısı; güçlü CYP3A4 inhibitörleriyle dikkat.', 'Günün aynı saatinde.'),
    I('ramipril', 'Ramipril', 'ACE inhibitörü', 'kapsül', '5 mg', 'normal', '#E3F2EF', 'Anjiyotensin II oluşumunu azaltır.', '—', 'Hiperkalemi, kuru öksürük, anjiyoödem; gebelikte kontrendike.', 'Her gün aynı saatte; dudak-dil şişmesinde acile başvur; potasyumlu tuz kullanma.'),
    I('losartan', 'Losartan', 'Anjiyotensin reseptör blokeri', 'tablet', '50 mg', 'normal', '#EAF0DC', 'AT1 reseptör blokajı.', 'CYP2C9 sub', 'Hiperkalemi; gebelikte kontrendike.', 'Her gün; baş dönmesinde yavaş kalk.'),
    I('spironolakton', 'Spironolakton', 'Potasyum tutucu diüretik', 'tablet', '25 mg', 'normal', '#FDE7DF', 'Aldosteron antagonisti.', '—', 'ACE inhibitörü/ARB ile hiperkalemi.', 'Sabah; potasyum desteği kullanma.'),
    I('hct', 'Hidroklorotiyazid', 'Tiyazid diüretik', 'tablet', '25 mg', 'normal', '#E8F4F8', 'Distal tübülde Na-Cl geri emilimini baskılar.', '—', 'Hipokalemi, hiponatremi; lityum düzeyini artırır.', 'Sabah (gece idrara kalkmamak için).'),
    I('amlodipin', 'Amlodipin', 'Kalsiyum kanal blokeri', 'tablet', '5 mg', 'normal', '#F5EEE0', 'Damar düz kasında kalsiyum girişini azaltır.', 'CYP3A4 sub', 'Ayak bileğinde ödem.', 'Her gün aynı saatte.'),
    I('metformin', 'Metformin', 'Biguanid (diyabet)', 'tablet', '1000 mg', 'normal', '#EEF3FA', 'Karaciğerde glukoz yapımını azaltır.', '—', 'Böbrek yetmezliğinde laktik asidoz riski; kontrastlı tetkiklerde ara verilebilir.', 'Yemekle; mide şikâyeti ilk haftalarda azalır.'),
    I('levotiroksin', 'Levotiroksin', 'Tiroid hormonu', 'tablet', '100 mcg', 'normal', '#FFF7DA', 'Eksik tiroid hormonunu yerine koyar.', '—', 'Kalsiyum, demir ve antasitler emilimini azaltır.', 'Sabah aç karnına, kahvaltıdan 30–60 dk önce, yalnız suyla; kalsiyum ve demirle arasına 4 saat koy.'),
    I('omeprazol', 'Omeprazol', 'Proton pompası inhibitörü', 'kapsül', '20 mg', 'normal', '#F0E6F7', 'Mide asit pompasını baskılar.', 'CYP2C19 inh', 'Klopidogrel aktivasyonunu azaltabilir (pantoprazol tercih edilebilir).', 'Kahvaltıdan önce.'),
    I('sertralin', 'Sertralin', 'SSRI antidepresan', 'tablet', '50 mg', 'normal', '#E4EEF8', 'Serotonin geri alımını baskılar.', 'CYP2D6 zayıf inh', 'Tramadol, triptanlar gibi serotonerjiklerle serotonin sendromu; NSAİİ/antiagreganla kanama.', 'Her gün; etkisi 2–4 haftada belirginleşir; kendiliğinden bırakma.'),
    I('tramadol', 'Tramadol', 'Opioid analjezik', 'kapsül', '50 mg', 'normal', '#F8E1D9', 'Zayıf opioid + serotonin/noradrenalin geri alım inhibisyonu.', 'CYP2D6 sub', 'Serotonerjik ilaçlarla serotonin sendromu ve nöbet; benzodiazepinle solunum depresyonu.', 'Araç kullanma; alkol alma.'),
    I('alprazolam', 'Alprazolam', 'Benzodiazepin', 'tablet', '0,5 mg', 'yesil', '#DFF0E2', 'GABA-A reseptör etkisini artırır.', 'CYP3A4 sub', 'Bağımlılık; opioidle solunum depresyonu. Yeşil reçeteyle verilir.', 'Araç kullanma; alkol alma; birden bırakma.'),
    I('morfin', 'Morfin', 'Güçlü opioid', 'tablet', '10 mg', 'kirmizi', '#F6D3D3', 'Mü-opioid reseptör agonisti.', '—', 'Solunum depresyonu, kabızlık. Kırmızı reçeteyle verilir.', 'Saatinde; kabızlık için önlem; uyuşukluk ve yavaş solunumda acil.'),
    I('metilfenidat', 'Metilfenidat', 'Santral sinir sistemi uyarıcısı', 'tablet', '10 mg', 'kirmizi', '#F9DCCB', 'Dopamin ve noradrenalin geri alımını baskılar.', '—', 'İştahsızlık, uykusuzluk. Kırmızı reçeteyle verilir.', 'Sabah ve öğlen; akşam alma.'),
    I('nitrogliserin', 'Nitrogliserin', 'Nitrat (anjina)', 'dil altı tablet', '0,5 mg', 'normal', '#FDEED2', 'Nitrik oksit vericisi, damar genişletir.', '—', 'Fosfodiesteraz-5 inhibitörleriyle (sildenafil) ağır hipotansiyon.', 'Göğüs ağrısında oturarak dil altına; 5 dk’da geçmezse 112.'),
    I('sildenafil', 'Sildenafil', 'Fosfodiesteraz-5 inhibitörü', 'tablet', '50 mg', 'normal', '#DCE8F8', 'cGMP yıkımını azaltır.', 'CYP3A4 sub', 'Nitratlarla birlikte kontrendike.', 'İhtiyaç halinde, günde en çok bir kez.'),
    I('digoksin', 'Digoksin', 'Kardiyak glikozit', 'tablet', '0,25 mg', 'normal', '#F2F2E0', 'Na/K-ATPaz inhibisyonu.', 'P-gp sub', 'Dar terapötik aralık; amiodaron düzeyini artırır; hipokalemide toksisite.', 'Nabız 60’ın altına düşerse, bulantı ya da görme bozukluğunda hekime başvur.'),
    I('amiodaron', 'Amiodaron', 'Antiaritmik', 'tablet', '200 mg', 'normal', '#E9DFD2', 'Potasyum kanal blokajı (sınıf III).', 'CYP3A4/2C9 ve P-gp inh', 'Digoksin, varfarin ve statin düzeylerini artırır; QT uzaması; tiroid ve akciğer etkileri.', 'Güneşten korun; düzenli tahlil.'),
    I('lityum', 'Lityum karbonat', 'Duygudurum düzenleyici', 'tablet', '300 mg', 'normal', '#E7E7F3', 'Hücre içi sinyal yollarını düzenler.', '—', 'Dar terapötik aralık; NSAİİ, tiyazid ve ACE inhibitörleri düzeyi artırır.', 'Bol sıvı al; ishal-kusmada hekime başvur; düzenli kan düzeyi.'),
    I('rifampisin', 'Rifampisin', 'Antitüberküloz', 'kapsül', '300 mg', 'normal', '#F8DCCB', 'Bakteriyel RNA polimerazı baskılar.', 'CYP3A4 güçlü ind', 'Güçlü enzim indükleyici: oral kontraseptif, varfarin ve birçok ilacın etkisini azaltır. Vücut sıvılarını turuncuya boyar.', 'Aç karnına; idrar ve gözyaşının turuncu olması beklenen bir etkidir.'),
    I('oks', 'Kombine oral kontraseptif', 'Hormonal kontrasepsiyon', 'tablet', '0,03/0,15 mg', 'normal', '#F7E1EC', 'Ovulasyonu baskılar.', 'CYP3A4 sub', 'Enzim indükleyicilerle etkinlik azalır; sigara içen 35 yaş üstünde tromboz riski.', 'Her gün aynı saatte.'),
    I('kalsiyum', 'Kalsiyum karbonat', 'Mineral desteği', 'efervesan tablet', '1000 mg', 'normal', '#F4F4F4', 'Kalsiyum desteği; antasit etkisi.', '—', 'Levotiroksin, demir ve kinolonların emilimini azaltır.', 'Yemekle; diğer ilaçlardan ayrı saatte.'),
    I('demir', 'Demir(II) sülfat', 'Mineral desteği', 'tablet', '80 mg Fe', 'normal', '#E8D9D0', 'Demir deposunu yerine koyar.', '—', 'Levotiroksin ve kinolonların emilimini azaltır; dışkıyı koyulaştırır.', 'Aç karnına ya da C vitaminiyle; çay-kahveyle değil.'),
    I('salbutamol', 'Salbutamol', 'Kısa etkili beta-2 agonist', 'inhaler', '100 mcg/doz', 'normal', '#DCEFF7', 'Bronşları genişletir.', '—', 'Çarpıntı, titreme.', 'Gerektiğinde 1–2 puf; haftada 2’den sık gerekiyorsa hekime söyle.')
  ];
  V.ilac = function (id) { return V.ILAC.filter(function (x) { return x.id === id; })[0] || null; };

  /* besinler ve alışkanlıklar (etkileşim ağında ilaç olmayan düğümler) */
  V.BESIN = [
    { id: 'greyfurt', ad: 'Greyfurt suyu' }, { id: 'alkol', ad: 'Alkol' }, { id: 'sut', ad: 'Süt ve süt ürünleri' }, { id: 'yesil', ad: 'Yeşil yapraklı sebze (K vitamini)' }
  ];
  V.dugum = function (id) { var a = V.ilac(id); if (a) return { id: id, ad: a.ad, besin: false }; var b = V.BESIN.filter(function (x) { return x.id === id; })[0]; return b ? { id: id, ad: b.ad, besin: true } : null; };

  /* ---------------- etkileşimler ----------------
     derece: kontrendike (birlikte verilmez) > ciddi (kaçın / yakın izlem) > orta (zamanlama, izlem) */
  V.DERECE = { kontrendike: { ad: 'Kontrendike', renk: '#B42318', sira: 0 }, ciddi: { ad: 'Ciddi', renk: '#D9622B', sira: 1 }, orta: { ad: 'Orta', renk: '#C99A1F', sira: 2 }, yok: { ad: 'Önemli etkileşim yok', renk: '#2E8E5B', sira: 3 } };
  var E = function (a, b, d, mek, oneri) { return { a: a, b: b, derece: d, mek: mek, oneri: oneri }; };
  V.ETK = [
    E('simvastatin', 'klaritromisin', 'kontrendike', 'Klaritromisin CYP3A4’ü güçlü baskılar; simvastatin düzeyi kat kat artar: miyopati ve rabdomiyoliz.', 'Antibiyotik süresince simvastatine ara ver ya da CYP3A4 üzerinden etkileşmeyen bir antibiyotik seçilmesi için hekimle görüş.'),
    E('sildenafil', 'nitrogliserin', 'kontrendike', 'İkisi de cGMP–nitrik oksit yolunda damar genişletir: ani ve ağır hipotansiyon.', 'Birlikte verilmez; hekime bildir.'),
    E('varfarin', 'ibuprofen', 'ciddi', 'NSAİİ trombosit işlevini bozar ve mide mukozasını zedeler; antikoagülanla kanama riski belirgin artar.', 'Ağrı için parasetamol öner; NSAİİ gerekiyorsa hekimle görüş.'),
    E('varfarin', 'asa', 'ciddi', 'Antikoagülan + antiagregan: kanama riski artar.', 'Yalnız hekimin bilinçli kombinasyonuysa ver; kanama belirtilerini anlat.'),
    E('varfarin', 'klaritromisin', 'ciddi', 'CYP inhibisyonu ve bağırsak florasındaki değişim INR’yi yükseltir.', 'INR’nin birkaç gün içinde kontrol edilmesini sağla; alternatif antibiyotiği hekimle değerlendir.'),
    E('varfarin', 'amiodaron', 'ciddi', 'Amiodaron CYP2C9’u baskılar: INR yükselir.', 'Varfarin dozunun azaltılması ve sık INR izlemi gerekir.'),
    E('ramipril', 'spironolakton', 'ciddi', 'İkisi de potasyumu tutar: hiperkalemi.', 'Serum potasyumu izlenmeli; potasyum desteği verilmemeli.'),
    E('losartan', 'spironolakton', 'ciddi', 'İkisi de potasyumu tutar: hiperkalemi.', 'Serum potasyumu izlenmeli.'),
    E('sertralin', 'tramadol', 'ciddi', 'İkisi de serotonin düzeyini artırır: serotonin sendromu (ajitasyon, titreme, ateş); tramadol nöbet eşiğini düşürür.', 'Hekimle görüş; serotonerjik olmayan bir analjezik düşünülmeli; belirtileri anlat.'),
    E('alprazolam', 'morfin', 'ciddi', 'Benzodiazepin + opioid: merkezi sinir sistemi ve solunum depresyonu.', 'Birlikte kullanım gerekiyorsa en düşük doz ve yakın izlem; hasta ve yakınını uyar.'),
    E('alprazolam', 'tramadol', 'ciddi', 'Benzodiazepin + opioid: sedasyon ve solunum depresyonu.', 'Hekimle görüş; alkol yok, araç kullanma yok.'),
    E('digoksin', 'amiodaron', 'ciddi', 'Amiodaron P-gp’yi baskılar: digoksin düzeyi yaklaşık iki katına çıkabilir.', 'Digoksin dozu azaltılmalı ve düzey izlenmeli.'),
    E('simvastatin', 'amiodaron', 'ciddi', 'Amiodaron simvastatin düzeyini artırır: miyopati.', 'Simvastatin dozu sınırlandırılmalı ya da başka statin seçilmeli.'),
    E('lityum', 'ibuprofen', 'ciddi', 'NSAİİ böbrekten lityum atılımını azaltır: lityum toksisitesi.', 'Parasetamol öner; NSAİİ gerekiyorsa lityum düzeyi izlenmeli.'),
    E('lityum', 'hct', 'ciddi', 'Tiyazidler lityum geri emilimini artırır: toksisite.', 'Hekimle görüş; lityum düzeyi izlenmeli.'),
    E('rifampisin', 'oks', 'ciddi', 'Rifampisin enzim indüklemesiyle hormon düzeyini düşürür: gebelik koruması kaybolur.', 'Tedavi süresince ve sonrasında 4 hafta ek (bariyer) yöntem gerekir.'),
    E('klaritromisin', 'amiodaron', 'ciddi', 'İkisi de QT aralığını uzatır; klaritromisin amiodaron düzeyini artırır: ritim bozukluğu.', 'Başka sınıf antibiyotik için hekimle görüş.'),
    E('simvastatin', 'greyfurt', 'ciddi', 'Greyfurt bağırsak CYP3A4’ünü baskılar: simvastatin düzeyi artar.', 'Greyfurt suyu içmemesini anlat.'),
    E('metronidazol', 'alkol', 'ciddi', 'Alkol yıkımı engellenir: bulantı, kusma, kızarma, çarpıntı (disülfiram benzeri).', 'Tedavi boyunca ve bittikten sonra 48 saat alkol yok.'),
    E('klopidogrel', 'omeprazol', 'orta', 'Omeprazol CYP2C19’u baskılar; klopidogrelin aktif şekle dönüşümü azalır.', 'Mide koruyucu gerekiyorsa pantoprazol gibi daha az etkileşen bir seçenek hekime önerilebilir.'),
    E('levotiroksin', 'kalsiyum', 'orta', 'Kalsiyum bağırsakta levotiroksini bağlar: emilim azalır.', 'Aralarına en az 4 saat koy.'),
    E('levotiroksin', 'demir', 'orta', 'Demir levotiroksinle kompleks oluşturur: emilim azalır.', 'Aralarına en az 4 saat koy.'),
    E('siprofloksasin', 'kalsiyum', 'orta', 'İki değerlikli katyonlar şelat oluşturur: antibiyotik emilimi azalır.', 'Siprofloksasini kalsiyumdan 2 saat önce ya da 6 saat sonra al.'),
    E('siprofloksasin', 'demir', 'orta', 'Demir şelat oluşturur: antibiyotik emilimi azalır.', 'Siprofloksasini demirden 2 saat önce ya da 6 saat sonra al.'),
    E('siprofloksasin', 'sut', 'orta', 'Süt kalsiyumu şelat oluşturur.', 'Süt ürünleriyle aynı anda alma.'),
    E('ramipril', 'ibuprofen', 'orta', 'NSAİİ antihipertansif etkiyi azaltır; özellikle diüretikle birlikte böbrek işlevini bozabilir.', 'Kısa süreli ve en düşük dozda; böbrek işlevi ve tansiyon izlenmeli.'),
    E('sertralin', 'asa', 'orta', 'SSRI’lar trombosit serotonin deposunu azaltır: kanama riski artar.', 'Mide kanaması belirtilerini anlat; gerekirse mide koruyucu.'),
    E('varfarin', 'yesil', 'orta', 'K vitamini varfarinin etkisini azaltır.', 'Yeşil yapraklı sebzeyi bırakma; her hafta benzer miktarda tüket.')
  ];
  var anahtar = function (a, b) { return a < b ? a + '|' + b : b + '|' + a; };
  var IDX = {}; V.ETK.forEach(function (e) { IDX[anahtar(e.a, e.b)] = e; });
  V.etkilesim = function (a, b) { return IDX[anahtar(a, b)] || null; };
  /* bir ilaç listesindeki tüm etkileşimler, en ciddiden */
  V.tara = function (ids) {
    var out = [];
    for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++) { var e = V.etkilesim(ids[i], ids[j]); if (e) out.push(e); }
    return out.sort(function (x, y) { return V.DERECE[x.derece].sira - V.DERECE[y.derece].sira; });
  };
  /* ağda düğüm olacak kimlikler (etkileşimi olanlar) */
  V.AG = (function () { var s = {}; V.ETK.forEach(function (e) { s[e.a] = 1; s[e.b] = 1; }); return Object.keys(s); })();

  /* ---------------- tohumlu rastgele ve kişisel çeşitlilik ---------------- */
  V.rng = function (t) { var s = (t >>> 0) || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  var AD = {
    E: { genc: ['Emre', 'Can', 'Burak', 'Onur', 'Kaan', 'Efe', 'Arda'], orta: ['Murat', 'Serkan', 'Hakan', 'Volkan', 'Kemal', 'Tamer'], yasli: ['Ahmet', 'Mehmet', 'Hasan', 'Yusuf', 'Ali', 'İsmail'], cocuk: ['Alp', 'Ege', 'Kuzey', 'Aras', 'Deniz'] },
    K: { genc: ['Elif', 'Zeynep', 'Selin', 'İrem', 'Büşra', 'Damla'], orta: ['Ayşe', 'Gül', 'Sevda', 'Esra', 'Nilay', 'Derya'], yasli: ['Fatma', 'Emine', 'Hatice', 'Zehra', 'Nuriye', 'Saadet'], cocuk: ['Zeynep', 'Ela', 'Defne', 'Mira', 'Asel'] }
  };
  var grupYas = function (y) { return y < 14 ? 'cocuk' : y < 36 ? 'genc' : y < 60 ? 'orta' : 'yasli'; };
  /* aynı cinsiyet ve yaş grubunda başka bir ad; yaş ±2 (çocukta ±1) oynar */
  V.kisi = function (h, r) {
    var L = AD[h.cins][grupYas(h.yas)], ad = L[Math.floor(r() * L.length)], dy = h.yas < 14 ? 1 : 2;
    var yas = Math.max(1, h.yas + Math.round((r() * 2 - 1) * dy));
    if (grupYas(yas) !== grupYas(h.yas)) yas = h.yas;
    return { ad: ad, yas: yas, cins: h.cins, kilo: h.kilo, hitap: h.yas < 14 ? ad : ad + (h.cins === 'K' ? ' Hanım' : ' Bey') };
  };

  /* ---------------- tezgâh: reçete vakaları ----------------
     gecerli: reçete geçerlilik sorusunun doğru yanıtı; sorun: profil kontrolündeki doğru bulgu;
     mudahale: doğru eylem; danisma: [metin, doğru mu] */
  var R = function (o) { return o; };
  V.RECETE = [
    R({ id: 'r-klaritro', hasta: { cins: 'E', yas: 68, kilo: 78 }, tur: 'normal', tani: 'Toplum kökenli pnömoni (ayaktan)', satir: [['klaritromisin', '2 x 1, 7 gün', 1]], mevcut: ['simvastatin', 'ramipril'], alerji: null, durum: 'Hipertansiyon, yüksek kolesterol',
      gecerli: 'gecerli', sorun: 'etk:simvastatin|klaritromisin', mudahale: 'hekim',
      danisma: [['Kürü iyileşse de 7 gün tamamla, 12 saatte bir al', true], ['Antibiyotik süresince simvastatini hekimin dediği gibi bırak; kas ağrısında başvur', true], ['Kendini iyi hissedince antibiyotiği bırakabilirsin', false], ['Greyfurt suyuyla almak etkiyi artırır, faydalıdır', false]] }),
    R({ id: 'r-penisilin', hasta: { cins: 'K', yas: 34, kilo: 64 }, tur: 'normal', tani: 'Akut sinüzit', satir: [['amoksiklav', '2 x 1, 10 gün', 1]], mevcut: [], alerji: 'Penisilin (kurdeşen, dudak şişmesi)', durum: 'Bilinen hastalığı yok',
      gecerli: 'gecerli', sorun: 'alerji', mudahale: 'hekim',
      danisma: [['Penisilin alerjin dosyana ve e-reçete sistemine işlensin; her eczanede söyle', true], ['Hekimin penisilin dışı antibiyotiğini bekle; bu ilacı alma', true], ['Alerji ilaçla birlikte antihistaminik alırsan sorun olmaz', false]] }),
    R({ id: 'r-varfarin', hasta: { cins: 'E', yas: 72, kilo: 81 }, tur: 'normal', tani: 'Diz osteoartriti ağrısı', satir: [['ibuprofen', '3 x 1, 10 gün', 1]], mevcut: ['varfarin', 'amlodipin'], alerji: null, durum: 'Atriyal fibrilasyon, hipertansiyon',
      gecerli: 'gecerli', sorun: 'etk:varfarin|ibuprofen', mudahale: 'hekim',
      danisma: [['Ağrı için parasetamol uygun; günlük sınırı aşma', true], ['Morarma, burun-diş eti kanaması, siyah dışkıda hemen başvur', true], ['Kanama olmasın diye varfarini kendi başına birkaç gün bırak', false]] }),
    R({ id: 'r-surup', hasta: { cins: 'K', yas: 5, kilo: 18 }, tur: 'normal', tani: 'Ateş', satir: [['parasetamol', 'Şurup 120 mg/5 ml · 4 x 20 ml', 1]], mevcut: [], alerji: null, durum: 'Sağlıklı çocuk', not: 'Prospektüs: çocukta 10–15 mg/kg/doz, en az 4 saat arayla.',
      gecerli: 'gecerli', sorun: 'doz', mudahale: 'hekim',
      danisma: [['Şurubu ölçek ya da enjektörle ölç, çay kaşığıyla değil', true], ['Başka parasetamollü ürünle (soğuk algınlığı şurubu) birlikte verme', true], ['Ateş düşmezse dozu iki katına çıkar', false]] }),
    R({ id: 'r-yesil', hasta: { cins: 'K', yas: 45, kilo: 66 }, tur: 'normal', tani: 'Anksiyete bozukluğu', satir: [['alprazolam', '2 x 1, 30 gün', 2]], mevcut: ['sertralin'], alerji: null, durum: 'Anksiyete, depresyon',
      gecerli: 'tur', sorun: 'tur', mudahale: 'recete',
      danisma: [['Bu ilaç yeşil reçeteyle verilir; hekimin yeşil reçete düzenlemesi gerekir', true], ['Alkol alma, uyuşukluk yaparsa araç kullanma', true], ['Normal reçeteyle bir kutu verip kalanını sonra tamamlayabiliriz', false]] }),
    R({ id: 'r-nitrat', hasta: { cins: 'E', yas: 59, kilo: 88 }, tur: 'normal', tani: 'Erektil disfonksiyon', satir: [['sildenafil', 'Gerektiğinde 1 tablet', 1]], mevcut: ['nitrogliserin', 'asa', 'atorvastatin'], alerji: null, durum: 'Koroner arter hastalığı, anjina',
      gecerli: 'gecerli', sorun: 'etk:sildenafil|nitrogliserin', mudahale: 'hekim',
      danisma: [['Göğüs ağrısı için dil altı nitrat kullandığın sürece bu ilaç birlikte alınmaz', true], ['Hekiminle başka seçenekleri konuş', true], ['Nitratı aldıktan 1 saat sonra almak güvenlidir', false]] }),
    R({ id: 'r-tiroid', hasta: { cins: 'K', yas: 28, kilo: 60 }, tur: 'normal', tani: 'Hipotiroidi (gebelik 2. trimester)', satir: [['levotiroksin', '1 x 1, sabah', 1]], mevcut: ['kalsiyum', 'demir'], alerji: null, durum: 'Gebelik, demir eksikliği',
      gecerli: 'gecerli', sorun: 'etk:levotiroksin|kalsiyum', mudahale: 'ver',
      danisma: [['Levotiroksini sabah aç karnına, yalnız suyla al', true], ['Kalsiyum ve demiri levotiroksinden en az 4 saat sonra al', true], ['Üçünü kahvaltıda birlikte almak en pratiği', false]] }),
    R({ id: 'r-cipro', hasta: { cins: 'E', yas: 41, kilo: 76 }, tur: 'normal', tani: 'Komplike olmayan idrar yolu enfeksiyonu', satir: [['siprofloksasin', '2 x 1, 7 gün', 1]], mevcut: [], alerji: null, durum: 'Bilinen hastalığı yok; her sabah süt içiyor',
      gecerli: 'gecerli', sorun: 'yok', mudahale: 'ver',
      danisma: [['Sütten 2 saat önce ya da 6 saat sonra al', true], ['Güneşten korun; topuk-bacak ağrısında hekime başvur', true], ['Süt mideyi korur, antibiyotiği sütle iç', false]] }),
    R({ id: 'r-serotonin', hasta: { cins: 'K', yas: 66, kilo: 70 }, tur: 'normal', tani: 'Bel ağrısı', satir: [['tramadol', '2 x 1, 5 gün', 1]], mevcut: ['sertralin', 'losartan'], alerji: null, durum: 'Depresyon, hipertansiyon',
      gecerli: 'gecerli', sorun: 'etk:sertralin|tramadol', mudahale: 'hekim',
      danisma: [['Titreme, terleme, huzursuzluk, ateş olursa hemen başvur', true], ['Hekimle görüşüp serotonerjik olmayan bir ağrı kesici değerlendirilecek', true], ['Sertralini birkaç gün bırakıp tramadol al', false]] }),
    R({ id: 'r-metro', hasta: { cins: 'E', yas: 52, kilo: 84 }, tur: 'normal', tani: 'Anaerop diş enfeksiyonu', satir: [['metronidazol', '3 x 1, 7 gün', 1]], mevcut: ['metformin'], alerji: null, durum: 'Tip 2 diyabet; hafta sonları alkol alıyor',
      gecerli: 'gecerli', sorun: 'etk:metronidazol|alkol', mudahale: 'ver',
      danisma: [['Tedavi süresince ve bittikten sonra 48 saat alkol alma', true], ['Ağızda metalik tat olabilir, zararsızdır', true], ['Az miktarda bira sorun olmaz', false]] })
  ];
  V.SORUN_SEC = function (r) {
    /* profil kontrolündeki seçenekler: doğru bulgu + benzer görünen çeldiriciler */
    var L = [], ekle = function (k, t) { if (!L.some(function (x) { return x[0] === k; })) L.push([k, t]); };
    var tum = r.satir.map(function (s) { return s[0]; }).concat(r.mevcut);
    if (/^etk:/.test(r.sorun)) { var p = r.sorun.slice(4).split('|'); ekle(r.sorun, 'Etkileşim: ' + V.dugum(p[0]).ad + ' + ' + V.dugum(p[1]).ad); }
    tum.forEach(function (a, i) { tum.slice(i + 1).forEach(function (b) { var e = V.etkilesim(a, b); if (e) ekle('etk:' + anahtar(a, b), 'Etkileşim: ' + V.dugum(a).ad + ' + ' + V.dugum(b).ad); }); });
    ekle('alerji', 'İlaç alerjisi ile çelişki'); ekle('doz', 'Doz yanlış (hesapla)'); ekle('tur', 'Reçete türü uygun değil');
    ekle('yok', 'Önemli sorun yok; danışmanlıkla verilir');
    return L;
  };
  V.MUDAHALE = [['ver', 'İlacı ver, danışmanlıkla uyar'], ['hekim', 'Vermeden önce hekimle iletişime geç, gerekçeyle alternatif öner'], ['recete', 'Bu reçeteyle verme; uygun türde reçete gerektiğini açıkla'], ['red', 'Hiçbir açıklama yapmadan reddet']];
  V.GECERLI = [['gecerli', 'Geçerli: hasta, hekim, tarih, imza, ilaç-doz-süre tam'], ['tur', 'Reçete türü bu ilaç için uygun değil'], ['eksik', 'Eksik bilgi var (doz ya da süre yazılmamış)']];
  /* doz kontrolü (şurup vakası): mg/kg/doz */
  V.mgKgDoz = function (ml, mgPer5, kg) { return Math.round(ml * mgPer5 / 5 / kg * 10) / 10; };

  /* ---------------- doz hesap masası: problem üreticileri ----------------
     her problem: { tip, metin, veri: [[etiket, değer]], cevap, birim, tol, cozum: [adım…] } */
  var y1 = function (x) { return Math.round(x * 10) / 10; };
  var tr1 = function (x) { return String(y1(x)).replace('.', ','); };
  V.DOZ_TIP = { surup: 'Çocuk şurubu (ml)', tablet: 'Tablet sayısı', crcl: 'Böbrek: kreatinin klirensi', infuzyon: 'İnfüzyon hızı (ml/saat)', sulandirma: 'Sulandırma (ml)' };
  V.crcl = function (yas, kg, kr, kadin) { return ((140 - yas) * kg) / (72 * kr) * (kadin ? 0.85 : 1); };
  V.problem = function (tip, r) {
    r = r || Math.random; var sec = function (L) { return L[Math.floor(r() * L.length)]; };
    if (tip === 'surup') {
      var kg = 8 + Math.round(r() * 22), il = sec([['Parasetamol', 15, 120], ['Parasetamol', 10, 250], ['İbuprofen', 10, 100]]), mg = kg * il[1], ml = mg / (il[2] / 5);
      return { tip: tip, metin: kg + ' kg çocuğa ' + il[0] + ' şurubu: hekim istemi ' + il[1] + ' mg/kg/doz. Şurup ' + il[2] + ' mg/5 ml. Bir dozda kaç ml?', veri: [['Kilo', kg + ' kg'], ['İstem', il[1] + ' mg/kg/doz'], ['Konsantrasyon', il[2] + ' mg/5 ml']], cevap: y1(ml), birim: 'ml', tol: 0.2,
        cozum: ['Doz = ' + kg + ' kg × ' + il[1] + ' mg/kg = ' + mg + ' mg', '1 ml’de ' + tr1(il[2] / 5) + ' mg var (' + il[2] + ' ÷ 5)', 'Hacim = ' + mg + ' ÷ ' + tr1(il[2] / 5) + ' = ' + tr1(ml) + ' ml'] };
    }
    if (tip === 'tablet') {
      var t = sec([['Levotiroksin', 75, 50, 'mcg'], ['Varfarin', 7.5, 5, 'mg'], ['Metformin', 1500, 1000, 'mg'], ['Prednizolon', 30, 5, 'mg'], ['Parasetamol', 1000, 500, 'mg']]), n = t[1] / t[2];
      return { tip: tip, metin: 'İstem: ' + t[0] + ' ' + String(t[1]).replace('.', ',') + ' ' + t[3] + '. Elde ' + t[2] + ' ' + t[3] + '’lik çentikli tablet var. Kaç tablet?', veri: [['İstem', String(t[1]).replace('.', ',') + ' ' + t[3]], ['Tablet', t[2] + ' ' + t[3]]], cevap: y1(n), birim: 'tablet', tol: 0.01,
        cozum: ['Tablet sayısı = istenen ÷ tablet gücü', String(t[1]).replace('.', ',') + ' ÷ ' + t[2] + ' = ' + tr1(n) + ' tablet' + (n % 1 ? ' (çentikten bölünür)' : '')] };
    }
    if (tip === 'crcl') {
      var kadin = r() < 0.5, yas = 55 + Math.round(r() * 30), kg2 = 50 + Math.round(r() * 35), kr = Math.round((0.9 + r() * 1.6) * 10) / 10, c = V.crcl(yas, kg2, kr, kadin);
      return { tip: tip, metin: (kadin ? 'Kadın' : 'Erkek') + ' hasta, ' + yas + ' yaş, ' + kg2 + ' kg, serum kreatinin ' + String(kr).replace('.', ',') + ' mg/dL. Cockcroft-Gault ile kreatinin klirensini hesapla. (Prospektüs: ≥50 normal doz; 30–49 doz yarıya; <30 kullanılmaz.)', veri: [['Yaş', yas], ['Kilo', kg2 + ' kg'], ['Kreatinin', String(kr).replace('.', ',') + ' mg/dL'], ['Cinsiyet', kadin ? 'kadın (× 0,85)' : 'erkek']], cevap: Math.round(c), birim: 'ml/dk', tol: 2,
        sinif: Math.round(c) >= 50 ? 'normal' : Math.round(c) >= 30 ? 'yari' : 'yok',
        cozum: ['CrCl = (140 − yaş) × kilo ÷ (72 × kreatinin)' + (kadin ? ' × 0,85' : ''), '(140 − ' + yas + ') × ' + kg2 + ' = ' + (140 - yas) * kg2, '72 × ' + String(kr).replace('.', ',') + ' = ' + tr1(72 * kr), 'Sonuç ≈ ' + Math.round(c) + ' ml/dk → ' + (Math.round(c) >= 50 ? 'normal doz' : Math.round(c) >= 30 ? 'doz yarıya' : 'kullanılmaz')] };
    }
    if (tip === 'infuzyon') {
      var kg3 = 55 + Math.round(r() * 40), d = sec([2, 3, 5, 8]), mgTop = 400, ml3 = sec([250, 500]), mgS = d * kg3 * 60 / 1000, kons = mgTop / ml3, hiz = mgS / kons;
      return { tip: tip, metin: 'Dopamin ' + d + ' mcg/kg/dk, hasta ' + kg3 + ' kg. Çözelti: ' + mgTop + ' mg dopamin ' + ml3 + ' ml’de. Pompa hızı kaç ml/saat?', veri: [['Doz', d + ' mcg/kg/dk'], ['Kilo', kg3 + ' kg'], ['Çözelti', mgTop + ' mg / ' + ml3 + ' ml']], cevap: y1(hiz), birim: 'ml/saat', tol: 0.3,
        cozum: ['Saatlik doz = ' + d + ' × ' + kg3 + ' × 60 = ' + d * kg3 * 60 + ' mcg = ' + tr1(mgS) + ' mg/saat', 'Konsantrasyon = ' + mgTop + ' ÷ ' + ml3 + ' = ' + tr1(kons) + ' mg/ml', 'Hız = ' + tr1(mgS) + ' ÷ ' + tr1(kons) + ' = ' + tr1(hiz) + ' ml/saat'] };
    }
    var fl = sec([[1000, 10], [500, 5], [1000, 4], [2000, 20]]), ist = sec([250, 350, 400, 600, 750]); if (ist > fl[0]) ist = fl[0] / 2;
    var konsS = fl[0] / fl[1], ml5 = ist / konsS;
    return { tip: 'sulandirma', metin: fl[0] + ' mg’lık toz flakon ' + fl[1] + ' ml enjeksiyonluk suyla sulandırılıyor (son hacim ' + fl[1] + ' ml). İstem ' + ist + ' mg. Kaç ml çekersin?', veri: [['Flakon', fl[0] + ' mg'], ['Sulandırma', fl[1] + ' ml'], ['İstem', ist + ' mg']], cevap: y1(ml5), birim: 'ml', tol: 0.1,
      cozum: ['Konsantrasyon = ' + fl[0] + ' ÷ ' + fl[1] + ' = ' + tr1(konsS) + ' mg/ml', 'Hacim = ' + ist + ' ÷ ' + tr1(konsS) + ' = ' + tr1(ml5) + ' ml'] };
  };
  V.dogruMu = function (p, x) { return x != null && !isNaN(x) && Math.abs(x - p.cevap) <= p.tol + 1e-9; };

  /* ---------------- majistral formüller ----------------
     bil: [ad, oran (a/a %) ya da sabit miktar, birim]; hedef: toplam miktar */
  V.MAJ = [
    { id: 'salisilik', ad: '%2 salisilik asitli vazelin', hedef: 100, birim: 'g', bil: [['Salisilik asit', 2], ['Beyaz vazelin', 98]], kullanim: 'Haricen; nasırlı ve pullanan cilde ince tabaka.',
      adim: ['Terazinin darasını al, salisilik asidi tart', 'Havanda az miktar vazelinle ezerek (levigasyon) ince macun yap', 'Kalan vazelini azar azar ekleyip homojen karıştır', 'Kavanoza aktar, kapağı kapat', 'Etiketle'],
      etiket: [['Ürün adı ve konsantrasyon (%2)', true], ['Miktar (100 g)', true], ['“Haricen kullanılır”', true], ['Hazırlama tarihi ve son kullanma', true], ['“Ağızdan, günde 3 kez”', false]] },
    { id: 'lassar', ad: 'Lassar pastası (çinko oksitli pasta)', hedef: 40, birim: 'g', bil: [['Çinko oksit', 25], ['Buğday nişastası', 25], ['Beyaz vazelin', 50]], kullanim: 'Haricen; bebek bezi bölgesinde koruyucu.',
      adim: ['Çinko oksit ve nişastayı ayrı ayrı tart', 'Tozları havanda karıştırıp elekten geçir', 'Vazelinin bir kısmıyla tozları ezerek pasta yap', 'Kalan vazelini ekleyip homojenleştir', 'Kavanoza aktar ve etiketle'],
      etiket: [['Ürün adı', true], ['Miktar (40 g)', true], ['“Haricen kullanılır”', true], ['Hazırlama tarihi ve son kullanma', true], ['“Steril”', false]] },
    { id: 'serum', ad: '%0,9 sodyum klorür çözeltisi (izotonik)', hedef: 500, birim: 'ml', bil: [['Sodyum klorür', 0.9], ['Saf su (… ml’ye tamamla)', null]], kullanim: 'Burun yıkama (haricen); steril değildir.',
      adim: ['Sodyum klorürü tart', 'Beherde suyun bir kısmında çözdür', 'Balon jojeye aktar, beheri çalkalayıp suyunu da ekle', 'Çizgiye kadar saf suyla tamamla ve karıştır', 'Şişeye aktar ve etiketle'],
      etiket: [['Ürün adı ve konsantrasyon (%0,9)', true], ['Hacim (500 ml)', true], ['“Steril değildir, enjeksiyonda kullanılmaz”', true], ['Hazırlama tarihi ve son kullanma', true], ['“Damar içine uygulanır”', false]] },
    { id: 'alkol', ad: '%70 etanol (%96’lık stoktan)', hedef: 100, birim: 'ml', bil: [['%96 etanol', 70 / 96 * 100], ['Saf su (… ml’ye tamamla)', null]], kullanim: 'Haricen; cilt antisepsisi.', seyrelt: { c1: 96, c2: 70 },
      adim: ['C₁V₁ = C₂V₂ ile gereken stok hacmini hesapla', 'Dereceli silindirle %96 etanolü ölç', 'Saf suyla 100 ml’ye tamamla (hacim büzülmesi nedeniyle karıştırıp yeniden tamamla)', 'Kapaklı şişeye aktar', 'Etiketle; ısıdan ve alevden uzak tut'],
      etiket: [['Ürün adı ve konsantrasyon (%70)', true], ['Hacim (100 ml)', true], ['“Haricen kullanılır; yanıcıdır”', true], ['Hazırlama tarihi', true], ['“Ağızdan alınabilir”', false]] }
  ];
  /* her bileşen için hedef miktar (g ya da ml); null = tamamlama */
  V.majMiktar = function (m) { return m.bil.map(function (b) { return b[1] == null ? null : Math.round(m.hedef * b[1] / 100 * 100) / 100; }); };
  V.tartTol = function (h) { return Math.max(0.05, h * 0.02); };   /* tartım toleransı: %2, en az 0,05 g */

  /* ---------------- Acadex Medica vaka dosyaları ----------------
     Medica'daki 6. kat (hastane eczanesi) hastalarıyla aynı kişi: ad, yaş, yakınma senaryoyla AYNI. */
  V.VAKA = [
    { id: 'klaritro', ad: 'Hüseyin Bey', yas: '71 yaş', renk: '#D9C9F2', sikayet: 'Zatürre için klaritromisin başlandı; kalp ve kolesterol ilaçlarını kullanıyor.',
      oyku: 'Hipertansiyon, yüksek kolesterol. Düzenli: simvastatin 40 mg akşam, ramipril 5 mg. Alerji yok. Kreatinin normal.',
      deg: [['liste', 'Kullandığı tüm ilaçların listesini (ilaç uzlaşısı) çıkar', true], ['etk', 'Yeni antibiyotiği listeyle etkileşim açısından tara', true], ['bobrek', 'Böbrek işlevine bak (doz için)', true], ['cilt', 'Cilt prick testi iste', false], ['ekg', 'Rutin efor testi öner', false]],
      bulgu: 'Klaritromisin güçlü CYP3A4 inhibitörü; simvastatin bu yolla yıkılır. Kreatinin klirensi 68 ml/dk.',
      tani: [['kontr', 'Kontrendike etkileşim: klaritromisin + simvastatin (miyopati riski)', true], ['doz', 'Böbrek yetmezliği nedeniyle doz aşımı', false], ['alerji', 'Makrolid alerjisi', false], ['yok', 'Sorun yok', false]],
      terapi: [['ara', 'Hekime bildir: antibiyotik süresince simvastatine ara verilmesini ya da etkileşmeyen antibiyotiği öner', true], ['kas', 'Hastaya kas ağrısı, koyu idrar belirtilerini anlat', true], ['kayit', 'Müdahaleyi ve kararı hasta dosyasına kaydet', true], ['ikisi', 'İkisini birlikte ver, sorun çıkarsa bakılır', false], ['doz2', 'Simvastatin dozunu iki katına çıkar', false]],
      ozet: 'Statin + güçlü CYP3A4 inhibitörü klasik kontrendike çifttir. Eczacının rolü etkileşimi yakalamak, gerekçeyle hekime alternatif önermek ve hastayı belirtiler konusunda eğitmektir.' },
    { id: 'varfarin', ad: 'Necati Bey', yas: '74 yaş', renk: '#FCE4C7', sikayet: 'Varfarin kullanıyor; diz ağrısı için ibuprofen istendi, INR 3,6 geldi.',
      oyku: 'Atriyal fibrilasyon; varfarin 5 mg. Hedef INR 2–3. Diş eti kanaması tarifliyor.',
      deg: [['inr', 'Son INR değerini ve trendini değerlendir', true], ['kanama', 'Kanama belirtilerini sor (diş eti, idrar, dışkı)', true], ['etk', 'Yeni istenen ilacı varfarinle etkileşim açısından tara', true], ['mr', 'Diz MR’ı iste', false], ['vitk', 'Hemen yüksek doz K vitamini ver', false]],
      bulgu: 'INR 3,6 (hedefin üstünde), hafif diş eti kanaması. İbuprofen kanama riskini belirgin artırır.',
      tani: [['etk', 'Ciddi etkileşim: varfarin + NSAİİ; INR zaten yüksek', true], ['alerji', 'NSAİİ alerjisi', false], ['yok', 'INR yüksekliği önemsiz', false]],
      terapi: [['para', 'İbuprofen yerine parasetamol öner; hekime bildir', true], ['inr', 'INR’nin hekim tarafından değerlendirilmesini ve yakın kontrolünü sağla', true], ['egitim', 'Kanama belirtilerinde başvurmasını anlat', true], ['birak', 'Varfarini kendi başına bıraktır', false]],
      ozet: 'Antikoagülan kullanan yaşlıda NSAİİ, INR’si yüksekken daha da tehlikelidir. Güvenli analjezik önerisi ve INR izlemi eczacının katkısıdır.' },
    { id: 'pediatri', ad: 'Elif', yas: '4 yaş', renk: '#D7EEF8', sikayet: 'Ateş için parasetamol şurubu istendi; annesi dozu soruyor.',
      oyku: '16 kg. Şurup 120 mg/5 ml; istem 4 × 15 ml. Prospektüs: 10–15 mg/kg/doz.',
      deg: [['kilo', 'Güncel kiloyu doğrula', true], ['hesap', 'mg/kg/doz hesabı yap', true], ['diger', 'Evde başka ateş düşürücü ya da soğuk algınlığı ilacı var mı sor', true], ['kan', 'Tam kan sayımı iste', false]],
      bulgu: '15 ml = 360 mg → 22,5 mg/kg/doz; önerilen aralığın (10–15) üstünde. Doğru hacim 7–10 ml.',
      tani: [['doz', 'Doz aşımı: 15 ml çok yüksek', true], ['dusuk', 'Doz düşük', false], ['etk', 'Etkileşim', false]],
      terapi: [['hekim', 'Hekimle görüşüp dozu kiloya göre düzelt (ör. 10 ml)', true], ['olcek', 'Ölçekle ya da enjektörle ölçmeyi göster', true], ['tek', 'Başka parasetamollü ürünle birlikte vermemesini anlat', true], ['cay', 'Çay kaşığıyla ölçmesini söyle', false]],
      ozet: 'Çocukta doz kiloya göredir. Hacmi mg/kg’a çevirip prospektüsle karşılaştırmak ve doğru ölçme aracını göstermek ilaç hatasını önler.' },
    { id: 'penisilin', ad: 'Derya Hanım', yas: '38 yaş', renk: '#FFF1D6', sikayet: 'Diş apsesi için amoksisilin-klavulanat yazıldı; geçen yıl penisilinle dudakları şişmiş.',
      oyku: 'Bilinen başka hastalığı yok. Dosyasında alerji kaydı yok.',
      deg: [['alerji', 'Alerjinin türünü ve şiddetini sor (kurdeşen, anjiyoödem)', true], ['kayit', 'Alerji kaydını kontrol et', true], ['test', 'Eczanede deri testi yap', false], ['dozu', 'Dozu yarıya indir', false]],
      bulgu: 'Önceki tepki: dudak şişmesi ve kurdeşen (anjiyoödem). Bu, penisilin grubunu kontrendike yapar.',
      tani: [['alerji', 'Gerçek penisilin alerjisi öyküsü: amoksisilin kontrendike', true], ['yan', 'Basit yan etki (ishal)', false], ['etk', 'Etkileşim', false]],
      terapi: [['hekim', 'Hekime bildir; penisilin dışı bir antibiyotik iste', true], ['kayit', 'Alerjiyi dosyaya ve e-reçete sistemine işlet', true], ['egitim', 'Hastaya her başvuruda alerjisini söylemesini anlat', true], ['antihis', 'Antihistaminikle birlikte ver', false]],
      ozet: 'Anjiyoödem öyküsü olan penisilin alerjisi ciddidir. Alerji kaydı yoksa eczacı yakalayıp kayda geçirmelidir.' },
    { id: 'tiroid', ad: 'Nazlı Hanım', yas: '29 yaş', renk: '#FFF7DA', sikayet: 'Gebelikte levotiroksin, demir ve kalsiyum başlandı; hepsini kahvaltıda alıyor; TSH yükselmiş.',
      oyku: 'Gebelik 20. hafta. Levotiroksin 100 mcg, demir 80 mg, kalsiyum 1000 mg.',
      deg: [['saat', 'İlaçları hangi saatte, neyle aldığını sor', true], ['uyum', 'Dozları atlayıp atlamadığını sor', true], ['etk', 'Emilim etkileşimlerini tara', true], ['usg', 'Ultrason iste', false]],
      bulgu: 'Üç ilacı kahvaltıda birlikte alıyor. Demir ve kalsiyum levotiroksin emilimini azaltır.',
      tani: [['emilim', 'Zamanlamaya bağlı emilim etkileşimi: levotiroksin + demir/kalsiyum', true], ['doz', 'Levotiroksin dozu kesinlikle yetersiz', false], ['alerji', 'Alerji', false]],
      terapi: [['sabah', 'Levotiroksini sabah aç karnına yalnız suyla aldır', true], ['ara', 'Demir ve kalsiyumu en az 4 saat sonra planla; yazılı saat çizelgesi ver', true], ['tsh', 'TSH’nin hekimce yeniden kontrol edilmesini sağla', true], ['birak', 'Gebelikte demiri bıraktır', false]],
      ozet: 'Çoğu “ilaç etkisizliği” zamanlamadan kaynaklanır. Basit bir saat çizelgesi ilacı değiştirmeden sorunu çözer.' },
    { id: 'serotonin', ad: 'Sevim Hanım', yas: '67 yaş', renk: '#E4EEF8', sikayet: 'Sertralin kullanırken tramadol başlandı; titreme, terleme ve huzursuzluk var.',
      oyku: 'Depresyon için sertralin 100 mg; üç gündür tramadol 2 × 50 mg. Ateş 38,1 °C.',
      deg: [['belirti', 'Belirtileri ve başlama zamanını değerlendir', true], ['liste', 'Serotonerjik ilaçları listele', true], ['vital', 'Ateş, nabız ve tansiyonu iste', true], ['bt', 'Beyin BT’si iste', false]],
      bulgu: 'Klonus, terleme, ajitasyon ve hafif ateş; iki serotonerjik ilaç birlikte.',
      tani: [['ss', 'Serotonin sendromu şüphesi (sertralin + tramadol)', true], ['grip', 'Grip', false], ['anks', 'Anksiyete atağı', false]],
      terapi: [['hekim', 'Hekime acil bildir; tramadolün kesilmesini öner', true], ['analj', 'Serotonerjik olmayan bir analjezik öner', true], ['bildir', 'Advers etkiyi farmakovijilans bildirimi olarak yap', true], ['artir', 'Tramadol dozunu artır', false]],
      ozet: 'Serotonerjik iki ilacın birlikteliği belirtilerle birleşince eczacı hızlı davranmalı: kesilmesi gereken ilacı ve güvenli alternatifi hekime iletmelidir.' },
    { id: 'lityum', ad: 'Orhan Bey', yas: '58 yaş', renk: '#E7E7F3', sikayet: 'Lityum kullanırken bel ağrısı için naproksen başlandı; bulantı ve el titremesi arttı.',
      oyku: 'Bipolar bozukluk; lityum 2 × 300 mg. Son lityum düzeyi 3 ay önce normal. Bir haftadır NSAİİ alıyor.',
      deg: [['duzey', 'Lityum düzeyi ve böbrek işlevi istenmesini sağla', true], ['etk', 'NSAİİ–lityum etkileşimini değerlendir', true], ['sivi', 'Sıvı alımını ve ishal-kusmayı sor', true], ['emg', 'EMG iste', false]],
      bulgu: 'Lityum düzeyi 1,6 mmol/L (yüksek); kreatinin hafif artmış.',
      tani: [['tok', 'NSAİİ’ye bağlı lityum toksisitesi', true], ['parkinson', 'Parkinson hastalığı', false], ['yok', 'Önemsiz', false]],
      terapi: [['kes', 'Hekime bildir; NSAİİ’nin kesilmesini ve parasetamolü öner', true], ['izle', 'Lityum düzeyinin yakın izlenmesini sağla', true], ['egitim', 'Hastaya toksisite belirtilerini ve sıvı alımını anlat', true], ['dozart', 'Lityum dozunu artır', false]],
      ozet: 'Dar terapötik aralıklı ilaçlarda küçük bir etkileşim toksisiteye yol açar. NSAİİ’ler lityum atılımını azaltır.' },
    { id: 'anafilaksi', ad: 'Barış Bey', yas: '33 yaş', renk: '#F6D3D3', sikayet: 'Arı sokmasıyla anafilaksi geçirdi; taburcu olurken adrenalin oto-enjektörü yazıldı.',
      oyku: 'Arı alerjisi. 76 kg. İlk kez oto-enjektör kullanacak.',
      deg: [['tetik', 'Tetikleyiciyi ve önceki tepkileri sor', true], ['beceri', 'Oto-enjektör kullanımını gösterip geri göstert', true], ['skt', 'Son kullanma tarihini ve saklama koşulunu kontrol et', true], ['kan', 'Kan şekeri ölç', false]],
      bulgu: 'Kullanımı bilmiyor; kalemi cebinde değil arabada tutmayı düşünüyor.',
      tani: [['egitim', 'Hasta eğitimi ihtiyacı: adrenalin oto-enjektörünün doğru kullanımı ve taşınması', true], ['etk', 'Etkileşim', false], ['doz', 'Doz yanlış', false]],
      terapi: [['uyluk', 'Uyluk dış yüzüne, gerekirse giysinin üzerinden uygulamayı göster', true], ['112', 'Uyguladıktan sonra 112’yi aramasını, gerekirse 5 dk sonra ikinci dozu anlat', true], ['tasima', 'İki kalemi her zaman yanında taşımasını, sıcakta bırakmamasını söyle', true], ['kalca', 'Kalçaya, kas içine doğru uygulamasını söyle', false]],
      ozet: 'Oto-enjektör yalnız doğru zamanda ve doğru yerde kullanılırsa hayat kurtarır. Göster-geri göster yöntemi en etkili eğitimdir.' }
  ];
  return V;
});
