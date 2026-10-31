/* ==========================================================================
   ACADEX MEDICA · hastane verisi (labs/medica/medica-veri.js), 31.10.2026
   Katlar (bölümler), rehber cerrahın tanıtım konuşması ve lab bağlantıları.
   Hastalar ayrı tutulmaz: her kat, labs/klinik/senaryo-*.js'teki senaryoları
   kimlik önekine göre toplar (ana-, fz-, ody-, dyt-, dkt-). Böylece vaka verisi
   tek yerde kalır; lab'daki vaka ile sahnedeki hasta ayrışmaz.
   ========================================================================== */
(function (root, factory) {
  var V = factory();
  if (typeof module === 'object' && module.exports) module.exports = V; else root.AXMEDICA = V;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var V = {};

  V.HASTANE = 'Acadex Medica';
  /* rehber: ameliyata hazırlanan nöbetçi cerrah (maske, bone, steril eldiven) */
  V.REHBER = { ad: 'Kaan Arslan', unvan: 'Op. Dr.', brans: 'genel cerrahi' };

  /* katlar: no (asansör), ad, bolum (öğrencinin bölümü), renk (yön bulma şeridi), onek (senaryo kimliği),
     lab (devir sayfası), mentor (katın sorumlusu), kars (kat karşılaması) */
  V.KAT = [
    { id: 'tip', no: 1, ad: 'Acil ve cerrahi', bolum: 'Tıp', renk: '#C9483B', acik: '#FBE9E6', onek: 'ana-', lab: 'anatomi', labAd: 'Anatomi Lab',
      mentor: 'Dr. Deniz', mcins: 'K', kars: 'Acil ve cerrahi katı. Hastanın yakınmasını anatomik bir yapıya bağlayacaksın; muayeneden sonra 3B modelde yapıları bulursun.' },
    { id: 'fizyo', no: 2, ad: 'Fizik tedavi ve rehabilitasyon', bolum: 'Fizyoterapi ve rehabilitasyon', renk: '#1E8A55', acik: '#E3F4EA', onek: 'fz-', lab: 'fizyo', labAd: 'Fizyo Lab',
      mentor: 'Fzt. Mert', mcins: 'E', kars: 'Rehabilitasyon katı. Anamnez ve muayeneden sonra doğru özel testi ya da rehabilitasyon protokolünü seçip Fizyo Lab’de 3B modelde uygularsın.' },
    { id: 'odyo', no: 3, ad: 'Odyoloji', bolum: 'Odyoloji', renk: '#6A4FA8', acik: '#EFEAF8', onek: 'ody-', lab: 'odyoloji', labAd: 'Odyoloji Lab',
      mentor: 'Ody. Ece', mcins: 'K', kars: 'Odyoloji katı. Hastayı dinle, kulağına bak, ölçüm planını kur; sonra vaka masasında testleri iste ve kabinde kendin ölç.' },
    { id: 'diyet', no: 4, ad: 'Beslenme ve diyet', bolum: 'Beslenme ve diyetetik', renk: '#D9822B', acik: '#FCEEDF', onek: 'dyt-', lab: 'diyet', labAd: 'Diyet Lab',
      mentor: 'Dyt. Selin', mcins: 'K', kars: 'Beslenme katı. Polikliniğe gelenler ve serviste yatanlar var. Görüşmeden sonra Diyet Lab’de reçeteyi ya da enteral-parenteral planı yazarsın.' },
    { id: 'dkt', no: 5, ad: 'Dil ve konuşma terapisi', bolum: 'Dil ve konuşma terapisi', renk: '#E0705A', acik: '#FBE6E1', onek: 'dkt-', lab: 'dkt', labAd: 'DKT Lab',
      mentor: 'DKT Defne', mcins: 'K', kars: 'Dil ve konuşma terapisi katı. Aileyle ve hastayla görüş, kısa gözlem yap; sonra vaka masasında değerlendirmeyi, tanısal izlenimi ve terapi planını seç.' }
  ];

  /* giriş: ilk ziyaret tanıtımı (maskeli rehber cerrah) */
  V.TANITIM = [
    'Acadex Medica’ya hoş geldin! Ben Op. Dr. Kaan Arslan, bugünün nöbetçi cerrahıyım. Maskeyi kusura bakma, birazdan ameliyata gireceğim.',
    'Burası sağlık bilimleri öğrencileri için kurulmuş bir eğitim hastanesi. Her katta bir bölüm var; hastalar bekleme salonunda sıra numaralarıyla seni bekliyor.',
    'Hastayı odaya çağırırsın: anamnez alır, muayene eder, sorumlu meslektaşınla kararını tartışırsın. Sonra ilgili lab’da reçeteyi, testi ya da 3B modeli tamamlarsın.',
    'İstersen nöbet tut: hastalar sırayla gelir, nöbet bitince karnen çıkar. Asansörle istediğin kata geçebilirsin.',
    'Hangi bölümde okuyorsun? Seni katına götüreyim.'
  ];
  V.TEKRAR = function (kat) { return 'Tekrar hoş geldin! ' + (kat ? kat.no + '. kata, ' + kat.ad.toLocaleLowerCase('tr') + ' katına mı çıkıyoruz?' : 'Hangi kata çıkıyoruz?'); };

  V.NOBET_HASTA = 4;         /* bir nöbette görülecek hasta sayısı (katta daha azı varsa o kadar) */
  V.NOBET_DK = 45;           /* nöbet saatinde hasta başına ilerleyen dakika */
  V.NOBET_BASLA = 8 * 60;    /* nöbet 08:00'de başlar */

  /* yatan hastalar bekleme salonunda oturmaz, serviste görülür */
  V.yatan = function (s) { return !!(s && (s.hasta.poz === 'yat' || s.oda === 'acil' || s.oda === 'ameliyathane')); };
  V.katBul = function (id) { return V.KAT.filter(function (k) { return k.id === id; })[0] || null; };
  V.katHastalari = function (kat, SEN) { return Object.keys(SEN).filter(function (id) { return id.indexOf(kat.onek) === 0; }).map(function (id) { return SEN[id]; }); };
  V.sira = function (kat, i) { return String(kat.no * 100 + i + 1); };

  /* lab devir adresi (labs/medica/ altından göreli). hedef: 'model' | 'recete' | 'ep' | 'vaka' | 'test:<id>' | 'prot:<id>' */
  V.devirAdres = function (s, hedef) {
    var q = '?medlab=1&medica=1';
    if (s.lab === 'anatomi') return '../anatomi/index.html' + q + '&vaka=' + encodeURIComponent(s.vaka);
    if (s.lab === 'fizyo') return '../fizyo/index.html' + q + '&fz=' + encodeURIComponent(hedef || '');
    if (s.lab === 'diyet') return '../diyet/index.html' + q + '&tab=' + (hedef === 'ep' ? 'ep' : 'vaka') + '&vaka=' + encodeURIComponent(s.vaka);
    if (s.lab === 'odyoloji') return '../odyoloji/index.html' + q + '&tab=vaka&vaka=' + encodeURIComponent(s.vaka);
    if (s.lab === 'dkt') return '../dkt/index.html' + q + '&tab=vaka&vaka=' + encodeURIComponent(s.vaka);
    return null;
  };

  /* hasta puanı: görüşme puanı; lab formu puan verdiyse ikisinin ortalaması */
  V.hastaPuan = function (r) { if (!r || r.sahne == null) return null; return r.lab == null ? r.sahne : Math.round((r.sahne + r.lab) / 2); };
  /* nöbet özeti: görülen hastalar, ortalama, en zayıf kalem */
  V.nobetOzet = function (n) {
    var g = (n.hastalar || []).filter(function (h) { return h.sahne != null; });
    var ort = g.length ? Math.round(g.reduce(function (a, h) { return a + V.hastaPuan(h); }, 0) / g.length) : 0;
    return { gorulen: g.length, toplam: (n.hastalar || []).length, ort: ort, triyaj: n.triyaj ? n.triyaj.puan : null, kod: n.kod && n.kod.puan != null ? n.kod.puan : null };
  };
  V.saat = function (dk) { var h = Math.floor(dk / 60) % 24, m = dk % 60; return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; };
  /* =========================== triyaj (31.10.2026) ===========================
     Üç renk (acil servis triyajında yaygın kullanılan sade ölçek): kırmızı hemen, sarı kısa sürede,
     yeşil bekleyebilir. Burada listelenmeyen hasta yeşildir (stabil, planlı başvuru).
     Gerekçe nöbetteki triyaj masasında öğrenciye gösterilir. */
  V.TRIYAJ_RENK = { kirmizi: { ad: 'Kırmızı', renk: '#D9362B', sira: 0, t: 'hemen' }, sari: { ad: 'Sarı', renk: '#E0A21B', sira: 1, t: 'kısa sürede' }, yesil: { ad: 'Yeşil', renk: '#2E9C5B', sira: 2, t: 'bekleyebilir' } };
  V.TRIYAJ = {
    'ana-supra': ['kirmizi', 'Radial nabız zayıf: kırık uçlar arteri sıkıştırıyor olabilir; iskemi ve kompartman sendromu riski.'],
    'ana-pterion': ['kirmizi', 'Düzelme sonrası yeniden bilinç bulanıklığı (lusid aralık): kafa içi kanama, dakikalar önemli.'],
    'ana-inme': ['kirmizi', 'Ani konuşamama ve tek taraflı güçsüzlük: akut inme, tedavi kararı zamana bağlı.'],
    'ana-kot': ['kirmizi', 'SpO₂ %89, taşikardi ve artan nefes darlığı: solunum tehlikede.'],
    'ana-kalca': ['sari', 'Kırık şüphesi ve şiddetli ağrı, vital bulgular stabil: kısa sürede görüntüleme ve analjezi.'],
    'ana-apandisit': ['sari', 'Akut karın bulguları ve ateş, hemodinami stabil: kısa sürede cerrahi değerlendirme.'],
    'fz-asil': ['sari', 'Akut tam kat tendon yırtığı şüphesi: aynı gün ortopedi değerlendirmesi gerekir.'],
    'ody-v-ani': ['sari', 'Ani sensörinöral işitme kaybı: tedaviye ilk günlerde başlanmalı.'],
    'dyt-e-refeed': ['kirmizi', 'BKİ 13,6 ve düşük K, P, Mg: yeniden beslenme sendromu riski yüksek.'],
    'dyt-e-inme': ['sari', 'Yoğun bakımda inme, ağızdan alım yok: beslenme planı geciktirilmemeli.'],
    'dyt-e-kbs': ['sari', 'Kısa bağırsak, enteral yol yetersiz: parenteral plan kısa sürede kurulmalı.'],
    'dyt-v-siroz': ['sari', 'Asitli siroz, belirgin kas kaybı ve hiponatremi: yatan hasta, beslenme riski.'],
    'dyt-v-yasli': ['sari', 'Ameliyat sonrası yaşlı, 2 ayda %9 kilo kaybı: beslenme riski yüksek.'],
    'dyt-v-ped-osteo': ['sari', 'Ateşli kemik enfeksiyonu olan çocuk, alım azalmış.'],
    'dyt-v-onko': ['sari', 'Kemoterapi sırasında bir ayda %7 kilo kaybı.'],
    'dkt-disfaji': ['sari', 'Öksürüksüz aspirasyon şüphesi ve ateş: aspirasyon pnömonisi riski.'],
    'dkt-osman': ['sari', 'Akut inme, ağızdan alım yok: yutma taraması geciktirilmemeli.']
  };
  V.triyaj = function (s) {
    var t = s && V.TRIYAJ[s.id]; if (t) return { renk: t[0], neden: t[1] };
    return { renk: 'yesil', neden: 'Genel durumu iyi, vital bulguları stabil: planlı poliklinik başvurusu.' };
  };
  /* triyaj kartında öğrencinin gördüğü ilk bilgi: geliş, yaş, yakınma ve varsa vital bulgular */
  V.ilkBakis = function (s) {
    var h = s.hasta, gel = V.yatan(s) ? (s.oda === 'acil' ? 'sedyede' : 'yatağında') : h.gorunum === 'cocuk' ? 'ailesiyle' : (s.refakat ? 'yakınıyla' : 'yürüyerek');
    var v = s.vital, vt = v ? ['nabız ' + v.nabiz, v.ta ? 'TA ' + v.ta : null, v.spo2 != null ? 'SpO₂ %' + v.spo2 : null, v.ates ? 'ateş ' + String(v.ates).replace('.', ',') + ' °C' : null].filter(Boolean).join(' · ') : 'vital bulgular olağan';
    return { gelis: gel, vital: vt };
  };
  /* öğrencinin seçimlerini puanla: sec {id: renk}; sıra kırmızı → sarı → yeşil (eşitte liste sırası) */
  V.triyajPuan = function (ids, sec, SEN) {
    var dogru = 0, eksik = 0, satir = ids.map(function (id) { var t = V.triyaj(SEN[id]), s = sec && sec[id]; if (!s) eksik++; if (s === t.renk) dogru++; return { id: id, dogru: t.renk, secim: s || null, ok: s === t.renk, neden: t.neden, eksikTriyaj: s && V.TRIYAJ_RENK[s].sira > V.TRIYAJ_RENK[t.renk].sira }; });
    return { satir: satir, dogru: dogru, toplam: ids.length, eksik: eksik, puan: ids.length ? Math.round(dogru / ids.length * 100) : 0 };
  };
  V.triyajSira = function (ids, SEN) { return ids.map(function (id, i) { return [id, V.TRIYAJ_RENK[V.triyaj(SEN[id]).renk].sira, i]; }).sort(function (a, b) { return a[1] - b[1] || a[2] - b[2]; }).map(function (x) { return x[0]; }); };

  /* =========================== acil kodlar (nöbette süreli olay) ===========================
     Adımlar doğru sırayla seçilir. Kaynak: ERC 2021 / AHA 2020 temel yaşam desteği, ERC 2021
     anafilaksi, ADA hipoglisemi “15-15 kuralı”, düşme sonrası değerlendirme (NICE CG161). */
  V.KOD = {
    mavi: { ad: 'Kod Mavi', renk: '#2F6BFF', sure: 45, olay: 'Bekleme salonunda bir hasta yere yığıldı. Seslenince yanıt vermiyor, göğsü kalkmıyor.',
      adimlar: ['Yanıtı ve solunumu kontrol et (en çok 10 saniye)', 'Yardım çağır, Kod Mavi ver, defibrilatör iste', 'Göğüs kompresyonuna başla: 30:2, dakikada 100–120, 5–6 cm', 'Defibrilatör gelince ritmi analiz ettir, gerekiyorsa şok', 'Ekip gelene kadar kesintisiz KPR sürdür'],
      not: 'Temel yaşam desteğinde zincir: tanı, yardım, erken ve kaliteli kompresyon, erken defibrilasyon. Kompresyona ara vermek beyin kanlanmasını keser (ERC 2021).' },
    bogulma: { ad: 'Kod Mavi · boğulma', renk: '#2F6BFF', sure: 40, olay: 'Yemekhanede bir hasta elini boğazına götürdü; konuşamıyor, öksürüğü giderek zayıflıyor.',
      adimlar: ['Öksürebiliyor mu sor; etkili öksürüğü destekle', 'Öksürük etkisizse öne eğ, kürek kemikleri arasına 5 sırt darbesi', 'Çıkmazsa 5 karın basısı (Heimlich)', 'Sırt darbesi ve karın basısını dönüşümlü sürdür', 'Bilinç kaybolursa yere yatır, yardım çağır, KPR başlat'],
      not: 'Yetişkinde yabancı cisim: etkili öksürük varken müdahale edilmez; etkisizse 5 sırt darbesi + 5 karın basısı dönüşümlü; bilinç kaybında KPR (ERC 2021).' },
    hipo: { ad: 'Acil · hipoglisemi', renk: '#E0A21B', sure: 40, olay: 'Diyabetli bir hasta terliyor, titriyor ve konuşması bulanıklaştı. Bilinci açık, yutabiliyor.',
      adimlar: ['Belirtileri tanı ve kan şekerini ölç (<70 mg/dL)', '15 g hızlı etkili karbonhidrat ver (ör. 150 ml meyve suyu)', '15 dakika sonra kan şekerini yeniden ölç', 'Hâlâ düşükse 15 g daha ver', 'Düzelince kompleks karbonhidratlı ara öğün; hekime bildir'],
      not: '“15-15 kuralı” (ADA): 15 g hızlı karbonhidrat, 15 dakika sonra ölçüm. Bilinci kapalı ya da yutamayan hastaya ağızdan bir şey verilmez; hekim glukagon ya da damar yolundan glukoz uygular.' },
    dusme: { ad: 'Acil · hasta düştü', renk: '#E0A21B', sure: 40, olay: 'Koridorda yaşlı bir hasta kaydı ve düştü; yerde inliyor, kalçasını tutuyor.',
      adimlar: ['Ortamı güvenli hale getir; kaldırmadan yanıtını ve solunumunu kontrol et', 'Yardım çağır; baş-boyun travması ve kanamaya bak', 'Ağrı, deformite, kısa ve dışa dönük bacak gibi kırık bulgularını değerlendir', 'Kırık şüphesi varsa hareket ettirmeden hekim çağır; yoksa destekle yavaşça kaldır', 'Vital bulguları ölç, olayı kaydet, düşme riskini yeniden değerlendir'],
      not: 'Düşme sonrası hasta kırık ve kafa travması dışlanmadan kaldırılmaz (NICE CG161). Kısa ve dışa dönük bacak kalça kırığını düşündürür.' },
    anafilaksi: { ad: 'Acil · anafilaksi', renk: '#C9483B', sure: 40, olay: 'Antibiyotik başlanan hastada dakikalar içinde yüzde şişlik, hırıltılı solunum ve tansiyon düşüklüğü gelişti.',
      adimlar: ['Havayolu, solunum ve dolaşımı değerlendir; yardım çağır, ilacı durdur', 'Uyluk dış yüzüne kas içi adrenalin uygula', 'Sırtüstü yatır, bacaklarını kaldır (solunum zorsa yarı oturur)', 'Yüksek akımlı oksijen; damar yolu ve sıvı', '5 dakikada düzelme yoksa adrenalini tekrarla'],
      not: 'Anafilakside ilk ve en önemli ilaç kas içi adrenalindir; antihistaminik ve steroid onu geciktirmemelidir (ERC 2021).' }
  };
  V.KOD_KAT = { tip: ['mavi', 'anafilaksi'], fizyo: ['dusme', 'mavi'], odyo: ['mavi', 'dusme'], diyet: ['hipo', 'bogulma'], dkt: ['bogulma', 'mavi'] };
  /* nöbet planı: iki ve daha çok hastalı nöbette bir kez, hastalar arasında (rnd testte sabitlenir) */
  V.kodPlan = function (katId, hastaSay, rnd) {
    rnd = rnd || Math.random; if (hastaSay < 2) return null;
    var L = V.KOD_KAT[katId] || ['mavi'];
    return { tip: L[Math.floor(rnd() * L.length)], i: 1 + Math.floor(rnd() * (hastaSay - 1)), puan: null };
  };
  /* kod puanı: her yanlış adım −15, süre biterse −30 */
  V.kodPuan = function (hata, sureBitti) { return Math.max(0, 100 - 15 * (hata || 0) - (sureBitti ? 30 : 0)); };

  /* =========================== konsültasyon zincirleri ===========================
     Aynı hasta birden çok katta görülür. Bir halka bitince öğrenci doğru bölüme sevk eder;
     sevk edilen kat hastayı konsültasyon notuyla karşılar. */
  V.KONSULT = [
    { id: 'inme', ad: 'Osman Bey · inme', zincir: ['ana-inme', 'dkt-osman', 'dyt-e-inme'],
      sevk: ['Su verilince öksürüyor ve konuşamıyor: ağızdan beslenmeden önce yutma taraması ve iletişim değerlendirmesi gerekir.',
        'Yutma taraması başarısız; ağızdan alım beklerken beslenme tüple sürdürülmeli: enteral planı diyetisyen yapar.'] },
    { id: 'kalca', ad: 'Fatma Hanım · kalça kırığı', zincir: ['ana-kalca', 'dyt-v-yasli', 'fz-kalca'],
      sevk: ['İki ayda belirgin kilo kaybı ve az yeme: ameliyat sonrası iyileşme için beslenme riski taranmalı.',
        'Beslenmesi toparlandı; güvenli yürüme ve düşmeyi önleme için rehabilitasyon gerekir.'] },
    { id: 'kerem', ad: 'Kerem · işitme ve dil', zincir: ['ody-v-kerem', 'dkt-kerem'],
      sevk: ['İşitme cihazı tek başına yetmez; dört yaşında 15 sözcük: dil terapisi hemen başlamalı.'] },
    { id: 'onko', ad: 'Nurten Hanım · kemoterapi', zincir: ['ody-v-ototoks', 'dyt-v-onko'],
      sevk: ['Bir ayda %7 kilo kaybı ve iştahsızlık: kemoterapi sürerken beslenme desteği gerekir.'] }
  ];
  /* senaryonun zincirdeki yeri: {z, i} ya da null */
  V.zincir = function (id) { for (var a = 0; a < V.KONSULT.length; a++) { var i = V.KONSULT[a].zincir.indexOf(id); if (i >= 0) return { z: V.KONSULT[a], i: i }; } return null; };
  /* senaryo kimliğinden kat */
  V.katOf = function (id) { return V.KAT.filter(function (k) { return id.indexOf(k.onek) === 0; })[0] || null; };
  /* sevk sorusu: doğru kat bir sonraki halkanın katı; seçenekler diğer katlar + “sevk gerekmez” */
  V.sevkSoru = function (id) {
    var r = V.zincir(id); if (!r || r.i >= r.z.zincir.length - 1) return null;
    var simdi = V.katOf(id), hedef = V.katOf(r.z.zincir[r.i + 1]);
    return { z: r.z, i: r.i, hedef: hedef.id, sonraki: r.z.zincir[r.i + 1], neden: r.z.sevk[r.i], secenek: V.KAT.filter(function (k) { return k.id !== simdi.id; }).map(function (k) { return k.id; }).concat(['yok']) };
  };
  /* konsültasyon notu: sevk edilen katta sahnenin başına eklenir */
  V.konsultNotu = function (id) {
    var r = V.zincir(id); if (!r || r.i === 0) return null;
    var k = V.katOf(r.z.zincir[r.i - 1]);
    return 'Konsültasyon notu · ' + k.no + '. kat, ' + k.ad.toLocaleLowerCase('tr') + ' (' + k.mentor + '): ' + r.z.sevk[r.i - 1];
  };

  /* =========================== canlı hastane: vakit ve anonslar =========================== */
  /* dakika (0..1439) → vakit: sabah 06–10, gündüz 10–17, akşam 17–20, gece 20–06 */
  V.vakit = function (dk) { var h = Math.floor(((dk % 1440) + 1440) % 1440 / 60); return h >= 6 && h < 10 ? 'sabah' : h >= 10 && h < 17 ? 'gunduz' : h >= 17 && h < 20 ? 'aksam' : 'gece'; };
  V.ANONS = {
    genel: ['Sayın ziyaretçilerimiz, hasta ziyaret saatleri 14.00 ile 16.00 arasındadır.', 'Lütfen sıra numaranızı ekrandan takip ediniz.', 'Hastanemizde sigara içilmemektedir.', 'Kan bağışı için ikinci kat kan merkezine bekleriz.', 'Lütfen el antiseptiğini kullanınız; enfeksiyonu birlikte önleyelim.'],
    tip: ['Dr. Deniz, acil servis kırmızı alana.', 'Radyoloji, acil BT hazır.', 'Ameliyathane 3 hazırlanıyor.'],
    fizyo: ['Fzt. Mert, hidroterapi havuzuna.', 'Grup egzersizi saat 15.00’te spor salonunda.'],
    odyo: ['Ody. Ece, yenidoğan taramasına.', 'Kabin 2 kalibrasyonda, lütfen kabin 1’i kullanınız.'],
    diyet: ['Dyt. Selin, dahiliye servisine.', 'Öğle yemeği servisleri başladı; diyet tepsileri kontrol edilsin.'],
    dkt: ['DKT Defne, nöroloji servisine yutma değerlendirmesi.', 'Çocuk oyun terapisi odası hazır.']
  };
  return V;
});
