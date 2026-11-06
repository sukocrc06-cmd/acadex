/* ==========================================================================
   ACADEX MEDICA · hastane verisi (labs/medica/medica-veri.js), 31.10.2026
   Katlar (bölümler), rehber hekimin tanıtım konuşması ve lab bağlantıları.
   Hastalar ayrı tutulmaz: her kat, labs/klinik/senaryo-*.js'teki senaryoları
   kimlik önekine göre toplar (ana-, fz-, ody-, dyt-, dkt-, ecz-, hem-). Böylece vaka verisi
   tek yerde kalır; lab'daki vaka ile sahnedeki hasta ayrışmaz.
   ========================================================================== */
(function (root, factory) {
  var V = factory();
  if (typeof module === 'object' && module.exports) module.exports = V; else root.AXMEDICA = V;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var V = {};

  V.HASTANE = 'Acadex Medica';
  /* rehber (06.11.2026): nöbetçi acil hekimi; beyaz önlük, steteskop, yaka kartı */
  V.REHBER = { ad: 'Ela Altındağ', unvan: 'Uzm. Dr.', brans: 'acil tıp' };

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
      mentor: 'DKT Defne', mcins: 'K', kars: 'Dil ve konuşma terapisi katı. Aileyle ve hastayla görüş, kısa gözlem yap; sonra vaka masasında değerlendirmeyi, tanısal izlenimi ve terapi planını seç.' },
    /* 01.11.2026: Eczacılık ve Hemşirelik */
    { id: 'ecz', no: 6, ad: 'Hastane eczanesi', bolum: 'Eczacılık', renk: '#7A4FA8', acik: '#EFE8F9', onek: 'ecz-', lab: 'eczacilik', labAd: 'Eczacılık Lab',
      mentor: 'Ecz. Tolga', mcins: 'E', kars: 'Hastane eczanesi katı. Hastalar reçeteleri ve ilaç sorularıyla geliyor. İlaç öyküsünü al, sorunu yakala; sonra Eczacılık Lab vaka masasında müdahaleni ve danışmanlığını yaz.' },
    { id: 'hem', no: 7, ad: 'Dahiliye servisi', bolum: 'Hemşirelik', renk: '#3B7DD8', acik: '#E7F0FC', onek: 'hem-', lab: 'hemsirelik', labAd: 'Hemşirelik Lab',
      mentor: 'Hem. Sevgi', mcins: 'K', kars: 'Dahiliye servisi. Yatan hastaların başında vital bulguları ölç, kötüleşmeyi erken yakala, önceliklendir; sonra Hemşirelik Lab vaka masasında hemşirelik tanını ve girişimlerini yaz.' }
  ];

  /* giriş: ilk ziyaret tanıtımı (rehber hekim) */
  V.TANITIM = [
    'Acadex Medica’ya hoş geldin! Ben Uzm. Dr. Ela Altındağ, bugünün nöbetçi acil hekimiyim. İlk gününde seni ben gezdireceğim; takıldığın yerde bana sorabilirsin.',
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
  V.yatan = function (s) { return !!(s && (s.hasta.poz === 'yat' || s.oda === 'acil' || s.oda === 'ameliyathane' || s.oda === 'servis')); };
  /* 02.11.2026: anatomi ara katları (A1–A8, 1. katın üstü) ÇEP vaka bankasından (labs/klinik/cep/) gelir */
  var CEP = typeof AXCEP !== 'undefined' ? AXCEP : null;   /* labs/klinik/cep/cep.js (önce yüklenir) */
  V.ARAKAT = (CEP && CEP.SISTEM ? CEP.SISTEM : []).map(function (s) {
    return { id: 'ak-' + s.id, no: 1, ara: true, etiket: s.etiket, sistem: s.id, ad: s.ad, bolum: 'Tıp · anatomi ara katı', renk: s.renk, acik: s.acik, onek: 'ak-' + s.id + '-',
      lab: 'anatomi', labAd: 'Anatomi Lab', mentor: s.mentor.unvan + ' ' + s.mentor.ad, mcins: s.mentor.cins, kars: s.kars };
  });
  V.tumKat = function () { return V.KAT.concat(V.ARAKAT); };
  V.katBul = function (id) { return V.tumKat().filter(function (k) { return k.id === id; })[0] || null; };
  /* ekranda kat adı: "3. kat" ya da "A2 ara kat" */
  V.katEtiket = function (k) { return k ? (k.ara ? k.etiket + ' ara kat' : k.no + '. kat') : ''; };
  V.katHastalari = function (kat, SEN) { return Object.keys(SEN).filter(function (id) { return id.indexOf(kat.onek) === 0; }).map(function (id) { return SEN[id]; }); };
  V.sira = function (kat, i) { return kat.ara ? kat.etiket + '·' + (i < 9 ? '0' : '') + (i + 1) : String(kat.no * 100 + i + 1); };

  /* lab devir adresi (labs/medica/ altından göreli). hedef: 'model' | 'recete' | 'ep' | 'vaka' | 'test:<id>' | 'prot:<id>' */
  V.devirAdres = function (s, hedef) {
    var q = '?medlab=1&medica=1';
    if (s.lab === 'anatomi') return '../anatomi/index.html' + q + '&vaka=' + encodeURIComponent(s.vaka);
    if (s.lab === 'fizyo') return '../fizyo/index.html' + q + '&fz=' + encodeURIComponent(hedef || '') + '&hasta=' + encodeURIComponent(s.hasta.hitap || s.hasta.ad);
    var ad = s.kimlik ? '&ad=' + encodeURIComponent(s.kimlik.ad) : '';   /* hastanedeki ad lab dosyasında da görünür */
    if (s.lab === 'diyet') return '../diyet/index.html' + q + '&tab=' + (hedef === 'ep' ? 'ep' : 'vaka') + '&vaka=' + encodeURIComponent(s.vaka) + ad;
    if (s.lab === 'odyoloji') return '../odyoloji/index.html' + q + '&tab=vaka&vaka=' + encodeURIComponent(s.vaka) + ad;
    if (s.lab === 'dkt') return '../dkt/index.html' + q + '&tab=vaka&vaka=' + encodeURIComponent(s.vaka) + ad;
    if (s.lab === 'eczacilik') return '../eczacilik/index.html' + q + '&tab=vaka&vaka=' + encodeURIComponent(s.vaka) + ad;
    if (s.lab === 'hemsirelik') return '../hemsirelik/index.html' + q + '&tab=vaka&vaka=' + encodeURIComponent(s.vaka) + ad;
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
    'dkt-osman': ['sari', 'Akut inme, ağızdan alım yok: yutma taraması geciktirilmemeli.'],
    'ecz-serotonin': ['sari', 'İki serotonerjik ilaç, ateş ve taşikardi: serotonin sendromu şüphesi.'],
    'ecz-lityum': ['sari', 'Lityum kullanırken bulantı ve titreme: toksisite dışlanmalı.'],
    'ecz-varfarin': ['sari', 'INR hedefin üstünde ve diş eti kanaması: kanama riski.'],
    'hem-pnomoni': ['kirmizi', 'SpO₂ %91 oksijenle, solunum 26/dk: NEWS2 yüksek, solunum yetmezliği gelişiyor.'],
    'hem-sepsis': ['kirmizi', 'Hipotansiyon, taşikardi, ateş ve yeni konfüzyon: sepsis şüphesi, ilk saat kritik.'],
    'hem-transf': ['kirmizi', 'Transfüzyon sırasında ateş, titreme, bel ağrısı ve hipotansiyon: akut reaksiyon.'],
    'hem-hipogl': ['sari', 'Kan şekeri 52 mg/dL: hipoglisemi hızla ağırlaşabilir.'],
    'hem-kky': ['sari', 'Bir günde 2 kg artış ve ortopne: sıvı yüklenmesi.']
  };
  V.triyaj = function (s) {
    var t = s && (V.TRIYAJ[s.id] || s.triyaj); if (t) return { renk: t[0], neden: t[1] };
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
  V.KOD_KAT = { tip: ['mavi', 'anafilaksi'], fizyo: ['dusme', 'mavi'], odyo: ['mavi', 'dusme'], diyet: ['hipo', 'bogulma'], dkt: ['bogulma', 'mavi'], ecz: ['anafilaksi', 'mavi'], hem: ['mavi', 'anafilaksi', 'dusme'] };
  /* acil kod rolleri (01.11.2026): eczane katında eczacı acil ilaçları hazırlar, serviste hemşire ilk müdahaleyi yapar.
     Rolü olmayan katta genel adımlar (V.KOD) kullanılır. Kaynak: ERC 2021 ileri yaşam desteği ve anafilaksi. */
  V.KOD_ROL = {
    ecz: { rol: 'Eczacı · acil ilaçlar',
      mavi: { adimlar: ['Kod Mavi anonsunu duyunca acil ilaç çantasıyla olay yerine git', 'Adrenalin 1 mg’ı (1 mg/10 ml) enjektöre hazırla ve etiketle', 'Ekip liderinin istemini yüksek sesle tekrar et (kapalı döngü iletişim)', 'Şoklanabilir ritim için 3. şoktan sonra verilecek amiodaron 300 mg’ı hazırla', 'Verilen ilaçları, dozları ve saatleri kayda geçir', 'Kod sonrası acil arabasındaki eksikleri tamamla, son kullanma tarihlerini kontrol et'],
        not: 'Kardiyak arrestte adrenalin 1 mg 3–5 dakikada bir; şoklanabilir ritimde 3. şoktan sonra amiodaron 300 mg (ERC 2021). Eczacı ilaçları hazırlar, kapalı döngü iletişimle doğrular ve kayıt tutar.' },
      anafilaksi: { adimlar: ['Şüpheli ilacın durdurulması için ekibi uyar, tetikleyiciyi belirle', 'IM adrenalin dozunu hesapla: yetişkin 0,5 mg = 1 mg/ml ampulden 0,5 ml', 'Uygun enjektör ve iğneyi hazırla, etiketle, uygulayacak hemşireye teslim et', '5 dakika sonra düzelme yoksa ikinci doz için hazır bulundur', 'Advers ilaç reaksiyonu bildirimini yap, alerjiyi kayda geçir'],
        not: 'Anafilakside yetişkine IM adrenalin 0,5 mg (1 mg/ml’den 0,5 ml) uyluk dış yüzüne; yanıt yoksa 5 dakikada bir tekrarlanır (ERC 2021). Antihistaminik ve steroid adrenalini geciktirmemelidir.' } },
    hem: { rol: 'Hemşire · ilk müdahale',
      mavi: { adimlar: ['Yanıtı ve solunumu kontrol et (en çok 10 saniye)', 'Yardım çağır, Kod Mavi ver, acil arabası ve defibrilatör iste', 'Göğüs kompresyonuna başla: 30:2, dakikada 100–120, 5–6 cm', 'Defibrilatör pedlerini yerleştir, ritim analizine izin ver', 'Damar yolu aç, istemdeki ilaçları uygula, kompresyonu sürdür', 'Olay saatlerini ve uygulamaları kaydet'],
        not: 'Serviste arresti çoğu zaman ilk hemşire fark eder: erken tanı, yardım çağırma ve kesintisiz kaliteli kompresyon ilk dakikalarda hayat kurtarır (ERC 2021).' },
      anafilaksi: { adimlar: ['Şüpheli ilacı ya da infüzyonu hemen durdur, yardım çağır', 'Havayolu, solunum ve dolaşımı değerlendir; hekime haber ver', 'İstemle uyluk dış yüzüne IM adrenalin uygula', 'Sırtüstü yatır, bacaklarını kaldır (solunum zorsa yarı oturur)', 'Yüksek akışlı oksijen ver, damar yolu aç, vital bulguları sık izle', 'Alerjiyi dosyaya ve bilekliğe işaretle, uygulamaları kaydet'],
        not: 'Anafilakside ilk iş tetikleyiciyi durdurmak, ilk ilaç IM adrenalindir (ERC 2021). Alerjinin kayda ve bilekliğe işlenmesi tekrarını önler.' } }
  };
  /* kat için kod adımları: rol varsa role özgü, yoksa genel */
  V.kodAdim = function (tip, katId) { var r = V.KOD_ROL[katId], k = V.KOD[tip]; return r && r[tip] ? { adimlar: r[tip].adimlar, not: r[tip].not, rol: r.rol } : { adimlar: k.adimlar, not: k.not, rol: null }; };
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
  V.katOf = function (id) { return V.tumKat().filter(function (k) { return id.indexOf(k.onek) === 0; })[0] || null; };
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
    dkt: ['DKT Defne, nöroloji servisine yutma değerlendirmesi.', 'Çocuk oyun terapisi odası hazır.'],
    ecz: ['Ecz. Tolga, acil servise antidot talebi.', 'Steril hazırlama ünitesinde kemoterapi hazırlığı başladı.'],
    hem: ['Hem. Sevgi, 712 numaralı odaya.', 'Saat 14.00 ilaç turu başlıyor; ilaç arabaları hazırlansın.']
  };
  /* =========================== lab sonrası: hastaya bildir ve rehber hekim ipucu ===========================
     Anatomi ve Fizyo'da lab işi bitince öğrenci bulguyu yorumlar, hastaya anlatır (senaryo.sonu);
     Fizyo'da Fizyo Lab'de kurduğu ev programını hastaya verir. Rehber hekim ipucu kademeye göre puan düşürür. */
  V.IPUCU_CEZA = [5, 10, 20];   /* 1: sözel ipucu, 2: bölgeyi göster, 3: yapıyı göster */
  V.ipucuCeza = function (kademe) { return V.IPUCU_CEZA[Math.max(1, Math.min(3, kademe)) - 1]; };
  /* ev programı: items = Fizyo Lab'de programa eklenen egzersiz kimlikleri */
  V.programPuan = function (pr, items) {
    if (!pr) return null; items = items || [];
    var kacinId = pr.kacin.map(function (k) { return k[0]; }), yanlis = items.filter(function (i) { return kacinId.indexOf(i) >= 0; });
    if (pr.bos) return { puan: !items.length ? 100 : yanlis.length ? 0 : 50, hit: [], eksik: [], yanlis: yanlis, bos: true };
    var hit = items.filter(function (i) { return pr.oner.indexOf(i) >= 0; }), eksik = pr.oner.filter(function (i) { return items.indexOf(i) < 0; });
    var p = Math.round(Math.min(1, hit.length / Math.max(1, pr.en)) * 100) - 25 * yanlis.length;
    return { puan: Math.max(0, Math.min(100, p)), hit: hit, eksik: eksik, yanlis: yanlis };
  };
  /* cevap: {sorular: [seçilen indeks], program: [kimlik]} → her soru 1 birim, program 1,5 birim */
  V.sonuPuan = function (sonu, cevap) {
    cevap = cevap || {}; var rows = [], top = 0, ag = 0;
    (sonu.sorular || []).forEach(function (q, i) { var c = (cevap.sorular || [])[i], o = q.secenek[c], ok = !!(o && o[1]); rows.push({ t: q.s, ok: ok, secim: o ? o[0] : null, dogru: q.secenek.filter(function (x) { return x[1]; })[0][0], geri: o ? o[2] : 'Yanıt verilmedi.' }); top += ok ? 100 : 0; ag += 1; });
    var pp = V.programPuan(sonu.program, cevap.program);
    if (pp) { top += pp.puan * 1.5; ag += 1.5; }
    return { rows: rows, program: pp, puan: ag ? Math.round(top / ag) : 0 };
  };
  /* son lab puanı: Anatomi'de modelde bulma (iç çerçeve puanı) %70 + hastaya anlatma %30; Fizyo'da bildirim formu; ipucu cezası düşülür */
  V.labSonPuan = function (cerceve, sonuP, ipucu) {
    var p = cerceve != null ? Math.round(0.7 * cerceve + 0.3 * sonuP) : sonuP;
    return Math.max(0, Math.min(100, p - (ipucu || 0)));
  };
  /* =========================== her girişte farklı hastalar (01.11.2026) ===========================
     1) Kimlik: aynı vaka her ziyarette başka ad ve görünümle gelir. Yaş ve cinsiyet lab hesaplarına
        (Diyet: enerji, Odyoloji: prob boyu …) bağlı olduğundan değişmez. Ad, metinlerin içinde de
        değişir; Türkçe ekler (Kerem’le, Aslı’nın) bozulmasın diye yeni ad, eskisiyle aynı son ünlü
        ve aynı ses sonu taşıyan adlardan seçilir. Konsültasyon zincirindeki hasta her katta aynıdır.
     2) Aynı yakınma, farklı tanı: bir yakınma grubunun her ziyarette yalnız bir üyesi gelir; bekleme
        salonunda ve odada tanıyı ele vermeyen ortak yakınma görünür. */
  /* kuşağa uygun adlar: çocuk (<13), genç (13–35), orta yaş (36–59), yaşlı (60+) */
  var ISIM = {
    E: { cocuk: ['Efe', 'Arda', 'Ege', 'Kerem', 'Alp', 'Doruk', 'Mert', 'Emir', 'Yusuf', 'Ömer', 'Aras', 'Kaan', 'Berk', 'Çınar', 'Deniz', 'Poyraz', 'Eymen', 'Miraç', 'Atlas', 'Can', 'Umut', 'Eren', 'Batu', 'Kuzey', 'Taha', 'Alper', 'Yiğit'],
      genc: ['Burak', 'Emre', 'Onur', 'Cem', 'Barış', 'Kaan', 'Berk', 'Alper', 'Enes', 'Furkan', 'Umut', 'Kerem', 'Can', 'Tolga', 'Serkan', 'Mert', 'Arda', 'Okan', 'Sinan', 'Uğur', 'Yunus', 'Ozan', 'Batuhan', 'Eren', 'Selim', 'Oğuz', 'Doğukan', 'Burak'],
      orta: ['Ahmet', 'Mehmet', 'Mustafa', 'Murat', 'Serkan', 'Kemal', 'Cem', 'Hakan', 'Erkan', 'Volkan', 'Okan', 'Taner', 'Selim', 'Sinan', 'Levent', 'Kadir', 'Tuncay', 'Ercan', 'Uğur', 'Onur', 'Halil', 'Orhan', 'Tolga', 'Ali', 'Hasan', 'Yusuf', 'Ömer', 'Barış'],
      yasli: ['Osman', 'Hüseyin', 'Hasan', 'Recep', 'Halil', 'İbrahim', 'İsmail', 'Kemal', 'Necmi', 'Rıza', 'Nuri', 'Sami', 'Cengiz', 'Orhan', 'Mustafa', 'Ahmet', 'Mehmet', 'Ali', 'Kadir', 'Yunus', 'Hilmi', 'Şükrü', 'Bekir', 'Hamdi', 'Cemal', 'Remzi', 'Nihat'] },
    K: { cocuk: ['Ela', 'Nehir', 'Ada', 'Mira', 'Defne', 'Zeynep', 'Elif', 'Azra', 'Eylül', 'Duru', 'Asel', 'Lina', 'Masal', 'Ecrin', 'Öykü', 'Nil', 'Ceren', 'Yağmur', 'İpek', 'Su', 'Lara', 'Nisa', 'Beren', 'Melis'],
      genc: ['Büşra', 'Gizem', 'Merve', 'Esra', 'Selin', 'Ece', 'Aslı', 'Burcu', 'Tuğba', 'Seda', 'İpek', 'Nazlı', 'Duygu', 'Hande', 'Ebru', 'Elif', 'Zeynep', 'Defne', 'Melis', 'Ceren', 'Ezgi', 'Damla', 'Pınar', 'Yasemin', 'Sıla', 'Begüm', 'Cansu'],
      orta: ['Aslı', 'Burcu', 'Sevgi', 'Derya', 'Özlem', 'Sibel', 'Pınar', 'Dilek', 'Serap', 'Filiz', 'Meltem', 'Sema', 'Yasemin', 'Hülya', 'Canan', 'Leyla', 'Nilgün', 'Nurten', 'Gülay', 'Ebru', 'Esra', 'Songül', 'Şule', 'Banu', 'Tülay', 'Arzu', 'Hande', 'Merve'],
      yasli: ['Fatma', 'Ayşe', 'Emine', 'Hatice', 'Zehra', 'Nuriye', 'Saadet', 'Gönül', 'Ayten', 'Nermin', 'Melek', 'Songül', 'Gülay', 'Leyla', 'Hülya', 'Sevim', 'Necla', 'Şükran', 'Halime', 'Hacer', 'Naciye', 'Saniye', 'Türkan', 'Nurten', 'Güler', 'Nebahat', 'Kamile'] }
  };
  var UNLU = 'aıeioöuü', GRUP4 = { a: 'a', 'ı': 'a', e: 'e', i: 'e', o: 'o', u: 'o', 'ö': 'ö', 'ü': 'ö' };
  /* ek uyumu imzası: son ünlünün 4'lü grubu + ünlüyle mi bitiyor + sert ünsüz mü (ç f h k p s ş t) */
  V.imza = function (ad) {
    var s = String(ad).toLocaleLowerCase('tr'), son = '', i;
    for (i = s.length - 1; i >= 0; i--) if (UNLU.indexOf(s[i]) >= 0) { son = GRUP4[s[i]]; break; }
    var c = s[s.length - 1];
    return son + (UNLU.indexOf(c) >= 0 ? 'V' : 'C') + ('çfhkpsşt'.indexOf(c) >= 0 ? 'h' : '');
  };
  V.hash = function (t) { var h = 2166136261; t = String(t); for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  V.rng = function (seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  var KORU = ['Deniz', 'Ece', 'Defne', 'Mert', 'Selin', 'Kaan', 'Arslan', 'Tolga', 'Sevgi', 'Arda', 'Nil', 'Cem'];   /* mentor adları: metinde unvanla geçer, dokunulmaz */
  var HARF = 'A-Za-zÇĞİÖŞÜçğıöşüâîû';
  var adDegis = function (t, eski, yeni) {
    return String(t).replace(new RegExp('(^|[^' + HARF + '.])(' + eski + ')(?![' + HARF + '])', 'g'), function (m, on) { return on + yeni; });
  };
  var derin = function (o, f) {
    if (typeof o === 'string') return f(o);
    if (Array.isArray(o)) return o.map(function (x) { return derin(x, f); });
    if (o && typeof o === 'object') { var r = {}; Object.keys(o).forEach(function (k) { r[k] = k === 'mentor' ? o[k] : derin(o[k], f); }); return r; }
    return o;
  };
  var TENLER = ['#F2C7A1', '#E8B48A', '#D49A6A', '#B97E52', '#8E5C3A'];
  var SAC = { genc: ['#2E241C', '#5A3A22', '#8A5A2B', '#1E1A16', '#B07A3A', '#3A2A1E'], yasli: ['#C9C4BA', '#E2DED6', '#A8A39A', '#9C968C'] };
  var KIYAFET = ['#3E6E9E', '#C8573A', '#2E8E7E', '#7A4FA8', '#E0A526', '#4E9A6A', '#9E5B7A', '#2F6BFF', '#6E5236', '#D9472B', '#5E8F4A', '#2E3A5C'];
  /* anahtar: zincir kimliği (her katta aynı hasta) ya da senaryo kimliği */
  V.kimlik = function (sen, tohum, anahtar) {
    var h = sen.hasta, r = V.rng(V.hash(tohum + '|' + (anahtar || sen.id))), ilk = String(h.ad).replace(/^Bebek /, '').split(' ')[0];
    var yas = parseInt(h.yas, 10) || 0, kus = /günlük/.test(String(h.yas)) || yas < 13 ? 'cocuk' : yas < 36 ? 'genc' : yas < 60 ? 'orta' : 'yasli';
    var uygun = function (L) { return (L || []).filter(function (n, i, a) { return a.indexOf(n) === i && n !== ilk && KORU.indexOf(n) < 0 && V.imza(n) === V.imza(ilk); }); };
    var I = ISIM[h.cins] || {}, havuz = uygun(I[kus]);
    if (havuz.length < 2) havuz = uygun((I[kus] || []).concat(kus === 'cocuk' ? I.genc : kus === 'yasli' ? I.orta : kus === 'genc' ? I.orta : I.yasli));
    var yeni = KORU.indexOf(ilk) >= 0 || !havuz.length ? ilk : havuz[Math.floor(r() * havuz.length)];
    var yasli = h.gorunum === 'yasli';
    return { eski: ilk, ad: yeni, ten: TENLER[Math.floor(r() * TENLER.length)], sac: (yasli ? SAC.yasli : SAC.genc)[Math.floor(r() * (yasli ? SAC.yasli : SAC.genc).length)],
      kiyafet: KIYAFET[Math.floor(r() * KIYAFET.length)], gozluk: !yasli && h.gorunum !== 'cocuk' && r() < 0.25 };
  };
  V.kisisel = function (sen, tohum, anahtar) {
    var k = V.kimlik(sen, tohum, anahtar), f = k.ad === k.eski ? function (t) { return t; } : function (t) { return adDegis(t, k.eski, k.ad); };
    var o = derin(sen, f);
    o.hasta = Object.assign({}, o.hasta, { ten: k.ten, sac: k.sac, kiyafet: k.kiyafet, gozluk: o.hasta.gozluk || k.gozluk });
    o.kimlik = { eski: k.eski, ad: k.ad };
    return o;
  };
  /* aynı yakınma, farklı tanı: her ziyarette grubun bir üyesi gelir */
  V.GRUP = [
    { id: 'omuz', yakinma: 'Kolunu kaldırınca omuz ağrısı', uyeler: ['fz-omuz', 'fz-omuz-yirtik', 'fz-omuz-inst'] },
    { id: 'diz', yakinma: 'Sporda dizini burktu', uyeler: ['fz-lachman', 'fz-menisk', 'fz-mkb'] },
    { id: 'bilek', yakinma: 'El bileğinde ağrı', uyeler: ['fz-karpal', 'fz-dequervain'] },
    { id: 'dirsek', yakinma: 'Dirsek ağrısı', uyeler: ['fz-tenis', 'fz-golfer'] },
    { id: 'el', yakinma: 'Uyanınca elini kullanamıyor', uyeler: ['ana-radial', 'ana-ulnar'] },
    { id: 'iki-kulak', yakinma: 'İki kulakta duymakta zorlanıyor', uyeler: ['ody-v-presbi', 'ody-v-gurultu', 'ody-v-oto'] },
    { id: 'tek-kulak', yakinma: 'Tek kulakta işitme kaybı ve çınlama', uyeler: ['ody-v-ani', 'ody-v-noroma'] },
    { id: 'seker', yakinma: 'Şekeri yüksek, kilo vermek istiyor', uyeler: ['dyt-v-dm', 'dyt-v-gut-dm'] },
    { id: 'cocuk-konusma', yakinma: 'Çocuğun konuşması anlaşılmıyor', uyeler: ['dkt-ssd', 'dkt-yarik'] }
  ];
  V.grupOf = function (id) { return V.GRUP.filter(function (g) { return g.uyeler.indexOf(id) >= 0; })[0] || null; };
  /* ziyaret: görünen hastalar (kişiselleştirilmiş, katta karışık sırada) ve bu ziyarette gelmeyen grup üyeleri */
  V.ziyaret = function (SEN, tohum) {
    var r = V.rng(V.hash('ziyaret|' + tohum)), gizli = {};
    V.GRUP.forEach(function (g) { var var_ = g.uyeler.filter(function (id) { return SEN[id]; }); if (!var_.length) return; var sec = var_[Math.floor(r() * var_.length)]; var_.forEach(function (id) { if (id !== sec) gizli[id] = 1; }); });
    var out = {}, ids = Object.keys(SEN).filter(function (id) { return !gizli[id] && !/-taburcu$/.test(id); });
    /* katta sıra her ziyarette değişir (Fisher–Yates, tohumlu) */
    for (var i = ids.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = ids[i]; ids[i] = ids[j]; ids[j] = t; }
    ids.forEach(function (id) {
      var z = V.zincir(id), g = V.grupOf(id), s = V.kisisel(SEN[id], tohum, z ? 'zincir:' + z.z.id : id);
      if (g) { s.tani = s.baslik; s.baslik = g.yakinma; s.grup = g.id; }
      out[id] = s;
    });
    return { sen: out, gizli: Object.keys(gizli) };
  };
  /* =========================== sistematik anamnez (bölüme göre) ===========================
     Görüşmenin başına, senaryonun kendi sorularından önce eklenir. Senaryoda zaten sorulan klasik
     soru (ilaç, aile, alkol …) tekrar sorulmaz. Yanıtlar hastanın profilinden gelir; profil yalnız
     öykünün gerektirdiği yerlerde (PROFIL) yazılı, gerisi yaşa uygun nötr varsayılandır. */
  V.PROFIL = {
    'ana-supra': { sonyemek: 'Öğlen yemeğini yemişti, iki saat oldu.' },
    'ana-pterion': { sonyemek: 'Maçtan önce sandviç yedim.' },
    'ana-inme': { oz: 'Yüksek tansiyonu var; geçen yıl kalp ritim bozukluğu söylendi.', alis: '40 yıl sigara içti, beş yıl önce bıraktı.', sonyemek: 'Kahvaltıda bir yudum su verdik, öksürdü; başka bir şey yemedi.', soy: 'Annesi de inme geçirmişti.', alerji: 'Bildiğimiz bir alerjisi yok.' },
    'ana-kalca': { oz: 'Tansiyonum var. Kemik erimesi dediler ama ilaç kullanmadım.', sonyemek: 'Sabah biraz çorba içtim.', alerji: 'Bilinen alerjim yok.' },
    'ana-apandisit': { sonyemek: 'Dün akşamdan beri hiçbir şey yiyemedim.' },
    'ana-kot': { alis: 'Günde bir paket sigara içiyorum.', sonyemek: 'İki saat önce öğle yemeği yedim.', alerji: 'Penisiline alerjim var.' },
    'ana-ulnar': { oz: 'Bilinen bir hastalığım yok.' },
    'fz-ocb': { onceki: 'Ameliyattan sonra hastanede birkaç egzersiz öğrettiler.', ilac: 'Ağrı kesici ve on gün kan sulandırıcı iğne.' },
    'fz-tda': { onceki: 'Ameliyattan sonra hastanede yürüteçle yürüttüler.', ilac: 'Ağrı kesici, kan sulandırıcı ve tansiyon ilacı.', oz: 'Tansiyonum var, dizlerimde yıllardır kireçlenme vardı.' },
    'fz-kalca': { onceki: 'Ameliyattan sonra serviste birkaç gün yürüttüler.', ilac: 'Tansiyon ilacı ve kemik erimesi için yeni bir ilaç.', oz: 'Tansiyon ve kemik erimesi.' },
    'fz-asil': { onceki: 'Hiç tedavi almadım; sabahları biraz sertlik vardı.' },
    'fz-omuz-yirtik': { oz: 'Şekerim var, hap kullanıyorum.', ilac: 'Şeker hapı.' },
    'fz-karpal': { oz: 'Tiroidim az çalışıyor, ilaç kullanıyorum.', ilac: 'Tiroid ilacı.' },
    'ody-v-presbi': { oz: 'Tansiyonum var.', ilac: 'Tansiyon ilacı.' },
    'ody-v-kom': { kulakop: 'Sol kulağım çocukluğumdan beri akar; ameliyat olmadım.' },
    'ody-v-ansd': { oz: 'Yenidoğan yoğun bakımda 7 gün kaldı, sarılık için kan değişimi yapıldı.', ototoks: 'Yoğun bakımda antibiyotik verildi.' },
    'ody-v-noroma': { ototoks: 'Hayır, ilaç kullanmadım.' },
    'dyt-v-onko': { oz: 'Over kanseri; kemoterapi alıyorum.', ilac: 'Sisplatinli kemoterapi ve bulantı ilacı.', alis: 'Kullanmıyorum.' },
    'dyt-v-colyak': { ilac: 'Şimdilik ilaç kullanmıyorum.' },
    'dyt-v-ped-osteo': { oz: 'Sol bacağında kemik iltihabı; damardan antibiyotik alıyor.', ilac: 'Damardan antibiyotik ve ateş düşürücü.' },
    'dyt-e-peg': { oz: 'Dil kökü kanseri; radyoterapi alıyor.', alis: 'Yıllarca sigara içti, tanı alınca bıraktı.' },
    'dyt-v-osteo': { oz: 'Kemik erimesi; menopoza 50 yaşında girdim.' },
    'ecz-klaritro': { oz: 'Tansiyonum ve kolesterolüm var.', otc: 'Hayır, reçetesiz bir şey almıyorum.' },
    'ecz-varfarin': { oz: 'Kalp ritim bozukluğu ve tansiyon.', bobrek: 'Böbreklerim iyi dediler.' },
    'ecz-pediatri': { oz: 'Sağlıklı bir çocuk, sık hastalanmaz.', ilac: 'Düzenli ilacı yok; dün bir grip şurubu verdim.' },
    'ecz-penisilin': { oz: 'Bilinen bir hastalığım yok.', gebelik: 'Hayır, gebe değilim.' },
    'ecz-tiroid': { oz: 'Tiroidim az çalışıyor; gebeliğim sırasında anlaşıldı.', gebelik: 'Evet, 20 haftalık gebeyim.', otc: 'Gebelik vitamini kullanıyorum.' },
    'ecz-serotonin': { oz: 'Depresyon ve tansiyon.', otc: 'Hayır.' },
    'ecz-lityum': { oz: 'Bipolar bozukluk; yıllardır tedavi görüyorum.', alis: 'Sigara içiyorum, alkol kullanmıyorum.', otc: 'Bel ağrısı için naproksen aldım.' },
    'ecz-anafilaksi': { oz: 'Başka hastalığım yok.', alerji: 'Arı alerjim var; dün öğrendim.' },
    'hem-pnomoni': { oz: 'Tansiyonum var.', ilac: 'Tansiyon ilacı; burada antibiyotik veriyorlar.', alis: 'Kırk yıl sigara içtim, beş yıl önce bıraktım.' },
    'hem-postop': { oz: 'Safra kesesi taşı vardı; dün ameliyat oldum.' },
    'hem-sepsis': { oz: 'Şeker hastası; tansiyonu da var.', ilac: 'Şeker hapı ve tansiyon ilacı.' },
    'hem-hipogl': { oz: 'Yirmi yıldır şekerim var.', ilac: 'İnsülin, sabah ve akşam.' },
    'hem-dusme': { oz: 'Kalçam kırık, ameliyat bekliyorum; tansiyonum var.', ilac: 'Tansiyon ilacı ve idrar söktürücü.' },
    'hem-basi': { oz: 'İnme geçirdim, yataktan kalkamıyorum.', ilac: 'Kan sulandırıcı ve tansiyon ilacı.' },
    'hem-transf': { oz: 'Kansızlığım var, nedeni araştırılıyor.' },
    'hem-kky': { oz: 'Kalp yetmezliği ve tansiyon.' },
    'dkt-afazi': { oz: 'Üç hafta önce inme geçirdi; tansiyonu var.', ilac: 'Kan sulandırıcı ve tansiyon ilacı.', egitim: 'Emekli öğretmen; konuşmak onun için çok önemliydi.' },
    'dkt-pd': { oz: 'Parkinson hastalığı, sekiz yıldır.', ilac: 'Parkinson ilaçları, günde dört kez.', egitim: 'Emekli terzi; torunlarıyla konuşmayı çok sever.' },
    'dkt-disfaji': { oz: 'Sağ hemisfer inmesi, tansiyon ve kalp ritim bozukluğu.' },
    'dkt-osman': { oz: 'Yüksek tansiyonu ve kalp ritim bozukluğu var.', ilac: 'Tansiyon ilacı; kan sulandırıcı yeni başlandı.', alerji: 'Bildiğimiz alerjisi yok.' },
    'dkt-kerem': { gelisim: 'Yürümesi zamanında oldu ama ilk sözcüğünü iki yaşından sonra söyledi.', oz: 'İki taraflı işitme kaybı tanısı aldı.' },
    'dkt-ykek': { egitim: 'Bilgisayar mühendisiyim; işte çok toplantıya giriyorum.' },
    'dkt-nodul': { egitim: 'İlkokul öğretmeniyim; gün boyu konuşuyorum.' }
  };
  var VARS = {
    oz: function (h) { return h.cocuk ? 'Sık hastalanmaz, bilinen bir hastalığı yok.' : 'Bildiğim başka bir hastalığım yok, ameliyat da olmadım.'; },
    soy: function () { return 'Ailede bildiğim önemli bir hastalık yok.'; },
    ilac: function (h) { return h.cocuk ? 'Düzenli kullandığı bir ilaç yok.' : 'Düzenli kullandığım bir ilaç yok.'; },
    alerji: function (h) { return h.cocuk ? 'Bilinen bir alerjisi yok.' : 'Bilinen bir alerjim yok.'; },
    alis: function () { return 'Sigara da alkol de kullanmıyorum.'; },
    meslek: function (h) { return h.yas < 3 ? 'Evde bakıyoruz.' : h.yas < 7 ? 'Anaokuluna gidiyor.' : h.yas < 18 ? 'Okula gidiyor.' : h.yas < 26 ? 'Üniversitede okuyorum.' : h.yas < 65 ? 'Çalışıyorum; günüm çoğunlukla masa başında geçiyor.' : 'Emekliyim.'; },
    sonyemek: function () { return 'Sabah kahvaltı ettim, sonra bir şey yemedim.'; },
    agri: function (h) { return h.agri ? 'Şu an 7 civarı; hareket edince 8’e çıkıyor.' : 'Dinlenirken 3, zorlanınca 6 civarı.'; },
    aktivite: function (h) { return h.yas >= 65 ? 'Evdeki işlerimi yaparken zorlanıyorum, yürüyüşe çıkamıyorum.' : 'İşimi yaparken zorlanıyorum; sporu şimdilik bıraktım.'; },
    onceki: function () { return 'Bu yakınma için daha önce tedavi almadım.'; },
    gurultu: function (h) { return h.cocuk ? 'Gürültülü bir ortamda kalmadı.' : 'Gürültülü bir yerde çalışmadım, kulaklıkla da yüksek sesle dinlemem.'; },
    ototoks: function () { return 'Bildiğim böyle bir ilaç kullanmadım.'; },
    kulakop: function (h) { return h.cocuk ? 'Kulak ameliyatı olmadı, sık iltihap da geçirmedi.' : 'Kulak ameliyatı olmadım, sık iltihap da geçirmedim.'; },
    gelisim: function () { return 'İlk sözcüğünü bir yaş civarında söyledi, yürümesi de zamanında oldu.'; },
    isitme: function (h) { return h.cocuk ? 'Yenidoğan taramasından geçti, sonra ölçülmedi.' : 'İşitmemde bir sorun fark etmedim.'; },
    dil: function () { return 'Evde yalnız Türkçe konuşuyoruz.'; },
    egitim: function () { return 'Lise mezunuyum; gündelik hayatta çok konuşurum.'; },
    otc: function (h) { return h.cocuk ? 'Başka bir şey vermiyoruz.' : 'Reçetesiz bir ilaç ya da bitkisel ürün kullanmıyorum.'; },
    bobrek: function () { return 'Böbrek ya da karaciğer hastalığım yok.'; },
    gebelik: function () { return 'Hayır, gebe değilim, emzirmiyorum.'; },
    bosaltim: function () { return 'İdrarım normal, bağırsaklarım da çalışıyor.'; },
    dusmeoyku: function () { return 'Hayır, düşmedim.'; },
    uyku: function () { return 'Hastanede biraz zor uyuyorum ama idare ediyor.'; }
  };
  /* [id, soru (yetişkin), soru (çocuk/yakın), not başlığı, atlanacak senaryo soru kimlikleri] */
  var ANM_ORTAK = [
    ['oz', 'Daha önce geçirdiğiniz ya da süregen bir hastalığınız, ameliyatınız var mı?', 'Daha önce geçirdiği bir hastalık ya da ameliyat var mı?', 'Özgeçmiş', ['hastalik', 'ameliyat', 'tani', 'inme']],
    ['soy', 'Ailenizde önemli bir hastalık var mı?', 'Ailede önemli bir hastalık var mı?', 'Soygeçmiş', ['aile']],
    ['ilac', 'Düzenli kullandığınız ilaçlar var mı?', 'Düzenli kullandığı bir ilaç var mı?', 'İlaç', ['ilac']],
    ['alerji', 'Bilinen bir ilaç ya da besin alerjiniz var mı?', 'Bilinen bir alerjisi var mı?', 'Alerji', ['alerji']],
    ['alis', 'Sigara ya da alkol kullanıyor musunuz?', 'Sigara ya da alkol kullanıyor mu?', 'Alışkanlık', ['alkol', 'sigara']],
    ['meslek', 'Ne iş yapıyorsunuz?', 'Okula ya da kreşe gidiyor mu?', 'Meslek / okul', ['meslek', 'is', 'emekli', 'okul', 'kres']]
  ];
  var ANM_BOLUM = {
    tip: [['sonyemek', 'En son ne zaman yiyip içtiniz?', 'En son ne zaman yiyip içti?', 'Son yemek', ['aclik']]],
    fizyo: [['agri', 'Ağrınızı 0 ile 10 arasında puanlasanız kaç verirsiniz?', null, 'Ağrı şiddeti', ['agri']],
      ['aktivite', 'Bu yakınma günlük işlerinizi ve sporunuzu nasıl etkiliyor?', null, 'Günlük yaşam', ['spor', 'aktivite']],
      ['onceki', 'Bu bölge için daha önce tedavi ya da fizyoterapi aldınız mı?', null, 'Önceki tedavi', ['once', 'egz', 'cerrah']]],
    diyet: [['boykilo', 'Boyunuz ve kilonuz kaç?', 'Boyu ve kilosu kaç?', 'Boy-kilo', ['boykilo']]],
    odyo: [['gurultu', 'Gürültülü ortamda çalıştınız mı, yüksek sesle müzik dinler misiniz?', 'Gürültülü bir ortamda kaldı mı?', 'Gürültü öyküsü', ['gurultu', 'koruyucu', 'kulaklik', 'is']],
      ['ototoks', 'Kulağa zarar verebilen bir ilaç (bazı antibiyotikler, kemoterapi) kullandınız mı?', 'Kulağa zarar verebilen bir ilaç aldı mı?', 'Ototoksik ilaç', ['ilac']],
      ['kulakop', 'Daha önce kulak ameliyatı ya da sık kulak iltihabı geçirdiniz mi?', 'Sık kulak iltihabı geçirdi mi, kulak ameliyatı oldu mu?', 'Kulak öyküsü', ['kulak', 'akinti', 'once']]],
    dkt: [['gelisim', null, 'İlk sözcüklerini ve ilk adımlarını ne zaman attı?', 'Gelişim', ['gelisim']],
      ['isitme', 'İşitmenizde bir sorun var mı?', 'İşitmesi hiç ölçüldü mü?', 'İşitme', ['kulak', 'cihaz', 'isitme']],
      ['dil', null, 'Evde hangi dil ya da diller konuşuluyor?', 'Ev dili', ['dil']],
      ['egitim', 'Eğitiminiz ve gündelik konuşma ihtiyacınız nasıl?', null, 'Eğitim / iletişim', ['egitim']]],
    ecz: [['otc', 'Reçetesiz aldığınız ilaç, vitamin ya da bitkisel ürün var mı?', 'Reçetesiz ilaç, vitamin ya da bitkisel ürün veriyor musunuz?', 'Reçetesiz / bitkisel', ['otc', 'diger']],
      ['bobrek', 'Böbrek ya da karaciğer hastalığınız var mı?', null, 'Böbrek-karaciğer', ['bobrek', 'kreatinin']],
      ['gebelik', 'Gebelik ya da emzirme durumunuz var mı?', null, 'Gebelik / emzirme', ['gebelik', 'saat']]],
    hem: [['agri', 'Ağrınızı 0 ile 10 arasında puanlasanız kaç verirsiniz?', null, 'Ağrı', ['agri']],
      ['bosaltim', 'İdrar ve bağırsak alışkanlığınızda değişiklik var mı?', null, 'Boşaltım', ['idrar', 'bosaltim', 'inkontinans', 'gaz']],
      ['dusmeoyku', 'Son bir yılda düştünüz mü?', null, 'Düşme öyküsü', ['dusmeoyku']],
      ['uyku', 'Geceleri nasıl uyuyorsunuz?', null, 'Uyku', ['uyku']]]
  };
  /* bölümün kritik soruları 2 puan, diğerleri 1 */
  var ANM_KRITIK = { tip: ['oz', 'alerji', 'sonyemek'], fizyo: ['agri', 'oz'], diyet: ['boykilo', 'oz', 'ilac'], odyo: ['gurultu', 'ototoks', 'kulakop'], dkt: ['gelisim', 'isitme', 'oz'], ecz: ['ilac', 'alerji', 'otc', 'gebelik'], hem: ['alerji', 'agri', 'oz', 'dusmeoyku'] };
  V.anamnez = function (sen) {
    var kat = V.katOf(sen.id); if (!kat || !sen.hasta) return null;
    var h = sen.hasta, yas = parseInt(h.yas, 10) || 0, gunluk = /günlük/.test(String(h.yas)), cocuk = h.gorunum === 'cocuk' || gunluk;
    var var_ = sen.adimlar.filter(function (a) { return a.tip === 'sor'; }).reduce(function (m, a) { a.secenek.forEach(function (o) { m[o.id] = 1; }); return m; }, {});
    var kim = (cocuk || h.konusamaz) && sen.refakat ? 'refakat' : null;
    var P = V.PROFIL[sen.id] || {}, ilk = String(h.ad).split(' ')[0];
    var hh = { cocuk: cocuk, yas: gunluk ? 0 : yas, agri: h.ifade === 'agri' };
    /* boy-kilo: senaryodaki tartı ve boy ölçümünden */
    var olc = {}; sen.adimlar.forEach(function (a) { if (a.tip === 'eylem') a.secenek.forEach(function (o) { if (o.id === 'tarti' || o.id === 'boy') olc[o.id] = o.deger; }); });
    var cevap = function (id) {
      if (P[id]) return P[id];
      if (id === 'boykilo') return olc.boy && olc.tarti ? (kim ? 'Boyu ' : 'Boyum ') + olc.boy + ', kilo' + (kim ? 'su ' : 'm ') + olc.tarti + ' civarı.' : null;
      var t = VARS[id](hh); return kim && id === 'alis' ? 'Sigara da alkol de kullanmıyor.' : t;
    };
    var kid = kat.ara ? 'tip' : kat.id;   /* ara katlar tıp bölümünün sistematik anamnezini kullanır */
    var L = ANM_ORTAK.concat(ANM_BOLUM[kid] || []), kr = ANM_KRITIK[kid] || [], sec = [];
    L.forEach(function (x) {
      if (x[4].some(function (k) { return var_[k]; })) return;
      var soru = kim || cocuk ? x[2] : x[1]; if (!soru) return;
      if (kat.id === 'dkt' && ((x[0] === 'gelisim' || x[0] === 'dil') && !cocuk || x[0] === 'egitim' && cocuk)) return;
      if ((gunluk && ['meslek', 'gurultu', 'kulakop'].indexOf(x[0]) >= 0) || (cocuk && x[0] === 'alis')) return;
      if (x[0] === 'gebelik' && !(h.cins === 'K' && yas >= 15 && yas <= 50)) return;
      var c = cevap(x[0]); if (!c) return;
      sec.push({ id: 'anm-' + x[0], t: soru, cevap: c, puan: kr.indexOf(x[0]) >= 0 ? 2 : 1, not: x[3] + '|' + c, kim: kim });
    });
    if (!sec.length) return null;
    return { tip: 'sor', baslik: 'Sistematik anamnez', yonerge: 'klasik soruları sor (' + kat.bolum.toLocaleLowerCase('tr') + ')', secenek: sec, ozet: 'Sistematik anamnez, gözden kaçan bir hastalığı ya da riski yakalamanın en güvenli yolu.', anamnez: true, ad: ilk };
  };
  /* anamnez adımını görüşmenin ilk sorusundan hemen önceye koyar */
  V.anamnezEkle = function (sen) {
    var a = V.anamnez(sen); if (!a) return sen;
    var i = sen.adimlar.map(function (x) { return x.tip; }).indexOf('sor'); if (i < 0) return sen;
    var ad = sen.adimlar.slice(); ad.splice(i, 0, a);
    return Object.assign({}, sen, { adimlar: ad });
  };
  /* =========================== ÇEP vaka bankası: ara kat hastaları (02.11.2026) ===========================
     Her ziyarette her ara kata AXCEP'ten tohumlu yeni hastalar gelir: aynı hastalık, farklı hasta (yaş, cinsiyet,
     eşlik eden hastalık, vital, tetkik değeri, tipik/atipik başvuru, ÇEP düzeyi). Ad kuşağa göre seçilir. */
  V.CEP_HASTA = 6;
  V.cepAd = function (cins, yas, r) {
    var kus = yas < 13 ? 'cocuk' : yas < 36 ? 'genc' : yas < 60 ? 'orta' : 'yasli', L = ((ISIM[cins] || {})[kus] || []).filter(function (n) { return KORU.indexOf(n) < 0; });
    return L.length ? L[Math.floor(r() * L.length)] : null;
  };
  V.cepZiyaret = function (tohum) {
    var out = {}; if (!CEP) return out;
    V.ARAKAT.forEach(function (k) {
      CEP.ziyaret(k.sistem, tohum, V.CEP_HASTA, { onek: k.onek, adSec: V.cepAd }).forEach(function (sen) {
        if (sen.profil) V.PROFIL[sen.id] = sen.profil;
        out[sen.id] = sen;
      });
    });
    return out;
  };
  return V;

});
