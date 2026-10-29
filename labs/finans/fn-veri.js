/* ==========================================================================
   ACADEX FİNANS · veri (labs/finans/fn-veri.js), 29.10.2026
   Bütün şirketler, fiyatlar ve oranlar KURGUSALDIR (ders kitabı tarzı).
   Gerçek kural setleri:
     - Incoterms® 2020 (ICC): 11 kural, 4'ü yalnız deniz/iç su yolu
     - Tekdüzen Hesap Planı (MSUGT) hesap kodları
     - UCP 600: bankanın vesaik incelemesi en çok 5 iş günü (md. 14/b)
     - KDV genel oranı %20 (Temmuz 2023'ten beri), ihracat istisnası
   ========================================================================== */
(function () {
  'use strict';
  var V = {};

  /* ---------------- MUHASEBE: Tekdüzen hesap planından seçki ---------------- */
  /* [kod, ad, grup, normal bakiye] grup: A aktif, P pasif (yabancı kaynak), O özkaynak, G gelir, M gider/maliyet */
  V.HESAP = [
    ['100', 'Kasa', 'A', 'B'], ['102', 'Bankalar', 'A', 'B'], ['120', 'Alıcılar', 'A', 'B'],
    ['153', 'Ticari Mallar', 'A', 'B'], ['190', 'Devreden KDV', 'A', 'B'], ['191', 'İndirilecek KDV', 'A', 'B'],
    ['255', 'Demirbaşlar', 'A', 'B'],
    ['300', 'Banka Kredileri', 'P', 'A'], ['320', 'Satıcılar', 'P', 'A'], ['360', 'Ödenecek Vergi ve Fonlar', 'P', 'A'],
    ['391', 'Hesaplanan KDV', 'P', 'A'],
    ['500', 'Sermaye', 'O', 'A'], ['590', 'Dönem Net Kârı', 'O', 'A'],
    ['600', 'Yurt İçi Satışlar', 'G', 'A'], ['601', 'Yurt Dışı Satışlar', 'G', 'A'],
    ['621', 'Satılan Ticari Mallar Maliyeti', 'M', 'B'], ['760', 'Pazarlama, Satış ve Dağıtım Giderleri', 'M', 'B'],
    ['770', 'Genel Yönetim Giderleri', 'M', 'B'], ['780', 'Finansman Giderleri', 'M', 'B']
  ];
  /* sık karıştırılan hesap çiftleri (çeldirici üretimi) */
  V.KARIS = { '191': '391', '391': '191', '600': '601', '601': '600', '120': '320', '320': '120', '102': '100', '100': '102', '153': '621', '621': '153', '760': '770', '770': '760', '300': '320', '255': '153', '780': '770', '500': '300' };
  V.SIRKET = 'Mavi Liman Ticaret A.Ş.';
  /* işlemler: s = [[kod, tutar, 'B'|'A'], ...] (yevmiye satırları) */
  V.ISLEM = [
    { id: 1, t: 'Ortaklar 500.000 TL sermayeyi şirketin banka hesabına yatırdı.', s: [['102', 500000, 'B'], ['500', 500000, 'A']], n: 'Bankadaki para (varlık) artar, borca; ortakların şirkete koyduğu kaynak (sermaye) artar, alacağa.' },
    { id: 2, t: '120.000 TL + %20 KDV ticari mal alındı, bedeli bankadan ödendi.', s: [['153', 120000, 'B'], ['191', 24000, 'B'], ['102', 144000, 'A']], n: 'Mal alışında ödenen KDV indirilecek KDV’dir (191, varlık). Banka azalır, alacağa.' },
    { id: 3, t: '80.000 TL + KDV ticari mal veresiye (vadeli) alındı.', s: [['153', 80000, 'B'], ['191', 16000, 'B'], ['320', 96000, 'A']], n: 'Veresiye alışta borç satıcıya doğar: 320 Satıcılar (yabancı kaynak) alacağa.' },
    { id: 4, t: 'Maliyeti 90.000 TL olan mal 150.000 TL + KDV’ye veresiye satıldı (sürekli envanter).', s: [['120', 180000, 'B'], ['600', 150000, 'A'], ['391', 30000, 'A'], ['621', 90000, 'B'], ['153', 90000, 'A']], n: 'Satışta tahsil edilecek KDV hesaplanan KDV’dir (391). Sürekli envanterde maliyet aynı anda 621’e, stoktan (153) çıkarak yazılır.' },
    { id: 5, t: 'Maliyeti 25.000 TL olan mal 40.000 TL’ye ihraç edildi, bedel bankaya geldi.', s: [['102', 40000, 'B'], ['601', 40000, 'A'], ['621', 25000, 'B'], ['153', 25000, 'A']], n: 'İhracat KDV’den istisnadır, KDV hesaplanmaz. Satış yurt dışına olduğu için 601 Yurt Dışı Satışlar.' },
    { id: 6, t: 'Alıcılardan 100.000 TL bankaya tahsil edildi.', s: [['102', 100000, 'B'], ['120', 100000, 'A']], n: 'Bir varlık (banka) artar, öbürü (alacak) azalır; toplam varlık değişmez.' },
    { id: 7, t: 'Satıcılara olan borcun 60.000 TL’si bankadan ödendi.', s: [['320', 60000, 'B'], ['102', 60000, 'A']], n: 'Borç (kaynak) azalır, borca; banka azalır, alacağa.' },
    { id: 8, t: '30.000 TL + KDV bilgisayar (demirbaş) alındı, bankadan ödendi.', s: [['255', 30000, 'B'], ['191', 6000, 'B'], ['102', 36000, 'A']], n: 'Bir yıldan uzun kullanılacak varlık duran varlıktır: 255 Demirbaşlar.' },
    { id: 9, t: 'Bankadan 1 yıl vadeli 200.000 TL kredi kullanıldı.', s: [['102', 200000, 'B'], ['300', 200000, 'A']], n: 'Bir yıl içinde ödenecek kredi kısa vadeli yabancı kaynaktır: 300 Banka Kredileri.' },
    { id: 10, t: 'Bankadan kasaya 20.000 TL nakit çekildi.', s: [['100', 20000, 'B'], ['102', 20000, 'A']], n: 'İki varlık arasında yer değiştirme: kasa artar, banka azalır.' },
    { id: 11, t: 'Müşteriye mal gönderiminin 8.000 TL + KDV nakliye bedeli kasadan ödendi.', s: [['760', 8000, 'B'], ['191', 1600, 'B'], ['100', 9600, 'A']], n: 'Satılan malı müşteriye ulaştırma gideri pazarlama, satış ve dağıtım gideridir (760).' },
    { id: 12, t: 'Ofis personelinin 12.000 TL ücreti bankadan ödendi (vergiler yok sayıldı).', s: [['770', 12000, 'B'], ['102', 12000, 'A']], n: 'Yönetim işleri için yapılan gider 770 Genel Yönetim Giderleri.' },
    { id: 13, t: 'Kredi için 4.000 TL faiz bankadan ödendi.', s: [['780', 4000, 'B'], ['102', 4000, 'A']], n: 'Borçlanmanın maliyeti finansman gideridir (780).' }
  ];

  /* ---------------- PORTFÖY: kurgusal hisseler (reel, yıllık) ---------------- */
  /* aylık getiriler tek faktörlü modelden, sabit tohumla üretilir: her açılışta aynı veri */
  var rng = function (seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  var gauss = function (r) { var u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  V.RF = 0.03;              /* risksiz faiz (reel, yıllık) */
  V.ENDEKS = { k: 'AXF100', ad: 'AXF 100 Endeksi (kurgusal)', mu: 0.10, sd: 0.18 };
  V.HISSE = [
    { k: 'LMNLJ', ad: 'Liman Lojistik', sek: 'lojistik', beta: 1.15, alfa: 0.010, isd: 0.16, renk: '#2F6FB0' },
    { k: 'ANDGD', ad: 'Anadolu Gıda', sek: 'gıda', beta: 0.55, alfa: 0.012, isd: 0.12, renk: '#3E8E5B' },
    { k: 'BZKEN', ad: 'Bozkır Enerji', sek: 'enerji', beta: 0.90, alfa: -0.006, isd: 0.22, renk: '#E0A526' },
    { k: 'EGTKS', ad: 'Ege Tekstil', sek: 'tekstil', beta: 1.30, alfa: -0.020, isd: 0.20, renk: '#C8553D' },
    { k: 'YLDTK', ad: 'Yıldız Teknoloji', sek: 'teknoloji', beta: 1.55, alfa: 0.030, isd: 0.26, renk: '#6B4FB3' }
  ];
  V.AY = 60;
  (function () {
    /* örneklem ortalaması ve sapması modele tam otursun diye: piyasa şoku standartlaştırılır,
       hisseye özgü şok piyasadan arındırılıp standartlaştırılır (60 ayda rastgele sapma dersi bozmasın) */
    var r = rng(20261029), n = V.AY, i, mm = V.ENDEKS.mu / 12, ms = V.ENDEKS.sd / Math.sqrt(12);
    var std = function (a) { var u = 0, s = 0, k; for (k = 0; k < n; k++) u += a[k]; u /= n; for (k = 0; k < n; k++) s += (a[k] - u) * (a[k] - u); s = Math.sqrt(s / (n - 1)); return a.map(function (x) { return (x - u) / s; }); };
    var z = [], m;
    for (i = 0; i < n; i++) z.push(gauss(r));
    z = std(z); m = z.map(function (x) { return mm + ms * x; });
    V.ENDEKS.ret = m;
    V.HISSE.forEach(function (h) {
      var e = [], k, b = 0, rf = V.RF / 12, ia = h.alfa / 12, is = h.isd / Math.sqrt(12);
      for (k = 0; k < n; k++) e.push(gauss(r));
      e = std(e); for (k = 0; k < n; k++) b += e[k] * z[k]; b /= (n - 1);
      e = std(e.map(function (x, q) { return x - b * z[q]; }));
      h.ret = e.map(function (x, q) { return rf + ia + h.beta * (m[q] - rf) + is * x; });
    });
  })();

  /* ---------------- DIŞ TİCARET: Incoterms 2020 ---------------- */
  /* masraf kalemleri (rota sırasıyla) */
  V.KALEM = ['Satıcı deposunda yükleme', 'İhracat gümrük işlemleri', 'Ön taşıma (yükleme limanına)', 'Limanda gemiye yükleme', 'Navlun (ana taşıma)', 'Ana taşıma sigortası', 'Varış limanında boşaltma', 'Son taşıma (alıcı deposuna)', 'İthalat gümrüğü ve vergiler', 'Alıcı deposunda boşaltma'];
  /* rota üzerindeki noktalar: 0 satıcı deposu · 1 yükleme limanı (gemi yanı) · 2 gemide · 3 varış limanı · 4 alıcı deposu
     risk: risk geçiş noktası; m: masrafı kim öder (S/A; sigortada küçük harf = zorunlu değil, riski taşıyanın menfaati) */
  V.INCO = [
    { k: 'EXW', ad: 'Ex Works · İşyerinde Teslim', mod: 'her', risk: 0, m: 'AAAAAaAAAA', yer: 'satıcının deposu', not: 'Satıcının yükümlülüğü en az olan kural: malı deposunda hazır eder, yüklemez, ihracat gümrüğünü de yapmaz.' },
    { k: 'FCA', ad: 'Free Carrier · Taşıyıcıya Masrafsız', mod: 'her', risk: 0.15, m: 'SSAAAaAAAA', yer: 'satıcının deposu (taşıyıcının aracına yüklenince)', not: 'Teslim yeri satıcının deposuysa satıcı yükler; ihracat gümrüğü satıcıda. 2020’de alıcı, taşıyıcıdan yükleme kayıtlı konşimento istemesini taşıyıcıya bildirebilir.' },
    { k: 'FAS', ad: 'Free Alongside Ship · Gemi Yanında Masrafsız', mod: 'deniz', risk: 1, m: 'SSSAAaAAAA', yer: 'yükleme limanında gemi yanı', not: 'Mal, yükleme limanında geminin yanına (rıhtıma) konunca risk geçer. Dökme yük için tipiktir.' },
    { k: 'FOB', ad: 'Free On Board · Gemide Teslim', mod: 'deniz', risk: 2, m: 'SSSSAaAAAA', yer: 'yükleme limanında gemide', not: 'Mal gemiye yüklenince risk alıcıya geçer; navlunu alıcı öder. Konteyner yükte ICC, FOB yerine FCA’yı önerir.' },
    { k: 'CFR', ad: 'Cost and Freight · Masraflar ve Navlun', mod: 'deniz', risk: 2, m: 'SSSSSaAAAA', yer: 'risk: yükleme limanında gemide · navlun: varış limanına kadar', not: 'Risk FOB’taki gibi yükleme limanında geçer, ama navlunu satıcı öder. Risk ile masrafın ayrıldığı “C” grubu.' },
    { k: 'CIF', ad: 'Cost, Insurance and Freight · Masraflar, Sigorta ve Navlun', mod: 'deniz', risk: 2, m: 'SSSSSSAAAA', yer: 'risk: yükleme limanında gemide · navlun + sigorta: varış limanına kadar', not: 'Satıcı alıcı lehine sigorta yaptırır; en az ICC (C) teminatı, bedelin %110’u.' },
    { k: 'CPT', ad: 'Carriage Paid To · Taşıma Ödenmiş Olarak', mod: 'her', risk: 0.15, m: 'SSSSSaAAAA', yer: 'risk: ilk taşıyıcıya teslimde · taşıma: varış yerine kadar', not: 'CFR’nin her taşıma türüne uygun hâli: risk ilk taşıyıcıya teslimde geçer.' },
    { k: 'CIP', ad: 'Carriage and Insurance Paid To · Taşıma ve Sigorta Ödenmiş', mod: 'her', risk: 0.15, m: 'SSSSSSAAAA', yer: 'risk: ilk taşıyıcıya teslimde · taşıma + sigorta: varış yerine kadar', not: '2020 değişikliği: CIP’te sigorta en az ICC (A), yani “tüm riskler” teminatı.' },
    { k: 'DAP', ad: 'Delivered At Place · Belirlenen Yerde Teslim', mod: 'her', risk: 4, m: 'SSSSSsSSAA', yer: 'alıcının deposu (araç üzerinde, boşaltmaya hazır)', not: 'Satıcı malı varış yerine kadar götürür, boşaltmaz. İthalat gümrüğü ve vergiler alıcıda.' },
    { k: 'DPU', ad: 'Delivered at Place Unloaded · Boşaltılmış Olarak Teslim', mod: 'her', risk: 4.2, m: 'SSSSSsSSAS', yer: 'alıcının deposu (boşaltılmış)', not: '2020’de DAT’ın yerini aldı. Satıcının boşaltma yükümlülüğü olan tek kural.' },
    { k: 'DDP', ad: 'Delivered Duty Paid · Gümrük Vergisi Ödenmiş Teslim', mod: 'her', risk: 4, m: 'SSSSSsSSSA', yer: 'alıcının deposu (ithalat gümrüklenmiş, boşaltmaya hazır)', not: 'Satıcının yükümlülüğü en fazla olan kural: ithalat gümrüğü ve vergileri de satıcı öder.' }
  ];
  V.INCO_SORU = [
    { q: 'Alıcı malı satıcının fabrikasından kendi kamyonuyla alacak, ihracat gümrüğünü de kendisi yapacak.', k: 'EXW' },
    { q: 'Konteyner yük; satıcı malı kendi deposunda alıcının anlaştığı taşıyıcının aracına yükleyecek ve ihracat gümrüğünü yapacak.', k: 'FCA' },
    { q: 'Mersin’den denizyoluyla dökme buğday; risk gemiye yüklemede geçsin, navlunu alıcı ödesin.', k: 'FOB' },
    { q: 'Denizyolu; satıcı navlunu ve alıcı lehine en az ICC (C) sigortayı ödesin, risk yükleme limanında geçsin.', k: 'CIF' },
    { q: 'Karayoluyla Almanya’ya; satıcı taşımayı ve “tüm riskler” sigortasını ödesin, risk ilk taşıyıcıda geçsin.', k: 'CIP' },
    { q: 'Satıcı malı alıcının deposuna kadar getirip boşaltacak; ithalat gümrüğü alıcıda.', k: 'DPU' },
    { q: 'Satıcı her şeyi üstlenecek: alıcının kapısına kadar taşıma, ithalat gümrüğü ve vergiler dahil; boşaltma alıcıda.', k: 'DDP' },
    { q: 'Denizyolu; satıcı navlunu ödesin ama sigorta yükümlülüğü olmasın, risk gemide geçsin.', k: 'CFR' }
  ];
  /* akreditif (vesaik karşılığı, teyitli) akışı: aktörler ve adımlar [kimden, kime, ne] */
  V.LC_AKTOR = [['alici', 'Alıcı (ithalatçı)'], ['amir', 'Amir banka'], ['ihbar', 'İhbar / teyit bankası'], ['satici', 'Satıcı (ihracatçı)'], ['tasiyici', 'Taşıyıcı']];
  V.LC_ADIM = [
    ['alici', 'satici', 'Satış sözleşmesi', 'Taraflar ödeme şeklini “teyitli akreditif” olarak kararlaştırır.'],
    ['alici', 'amir', 'Akreditif başvurusu', 'Alıcı kendi bankasından (amir banka) satıcı lehine akreditif açmasını ister.'],
    ['amir', 'ihbar', 'Akreditif açılır', 'Amir banka akreditifi satıcının ülkesindeki muhabir bankaya (SWIFT MT700) iletir.'],
    ['ihbar', 'satici', 'İhbar ve teyit', 'Banka akreditifi satıcıya bildirir; teyit ederse ödemeyi kendisi de taahhüt eder.'],
    ['satici', 'tasiyici', 'Mal yüklenir', 'Satıcı malı gemiye yükler, taşıyıcıdan konşimentoyu (B/L) alır.'],
    ['satici', 'ihbar', 'Vesaik ibrazı', 'Fatura, konşimento, sigorta poliçesi, menşe şahadetnamesi bankaya sunulur.'],
    ['ihbar', 'satici', 'İnceleme ve ödeme', 'Banka vesaiki akreditif şartlarına göre inceler (UCP 600: en çok 5 iş günü); uygunsa öder.'],
    ['ihbar', 'amir', 'Vesaik ve rambursman', 'Vesaik amir bankaya gönderilir, amir banka ödenen bedeli karşılar.'],
    ['alici', 'amir', 'Ödeme, vesaik teslimi', 'Alıcı bedeli bankasına öder ve vesaiki alır.'],
    ['alici', 'tasiyici', 'Malın teslim alınması', 'Alıcı konşimentoyu ibraz ederek malı varış limanında teslim alır.']
  ];

  /* ---------------- FİNANSAL TABLO ANALİZİ: kurgusal şirketler (milyon TL) ---------------- */
  V.FIRMA = [
    { k: 'kiyi', ad: 'Kıyı Konteyner A.Ş.', sek: 'liman işletmeciliği', renk: '#2F6FB0',
      hz: 42, ala: 65, sto: 18, dv: 520, kv: 95, uv: 260, oz: 290, sat: 410, smm: 250, fg: 70, faiz: 28, vergi: 15 },
    { k: 'pamuk', ad: 'Pamukova Tekstil A.Ş.', sek: 'tekstil ihracatı', renk: '#C8553D',
      hz: 9, ala: 120, sto: 160, dv: 140, kv: 260, uv: 60, oz: 109, sat: 520, smm: 430, fg: 55, faiz: 22, vergi: 3 },
    { k: 'yesil', ad: 'Yeşilvadi Gıda A.Ş.', sek: 'paketli gıda', renk: '#3E8E5B',
      hz: 55, ala: 70, sto: 60, dv: 190, kv: 110, uv: 40, oz: 225, sat: 600, smm: 420, fg: 110, faiz: 6, vergi: 16 }
  ];

  /* ---------------- KUR VE MAKRO ---------------- */
  V.KUR = { spot: 40.00, iTL: 0.36, iUSD: 0.045, gun: 90, tutar: 250000 };  /* kurgusal başlangıç değerleri */
  V.AKTARIM = [
    ['politika', 'Politika faizi'], ['piyasa', 'Kredi ve mevduat faizleri'], ['kredi', 'Kredi hacmi ve harcama'],
    ['talep', 'Toplam talep'], ['kur', 'Döviz kuru (TL)'], ['bekl', 'Enflasyon beklentisi'], ['enf', 'Enflasyon']
  ];

  /* ---------------- TÜREV: hazır stratejiler ---------------- */
  /* bacak: {t: 'call'|'put'|'hisse', y: +1 alış / -1 satış, K, p (prim / alış fiyatı), n} */
  V.STRAT = [
    { k: 'lcall', ad: 'Alım opsiyonu al (long call)', bac: [{ t: 'call', y: 1, K: 100, p: 6, n: 1 }], not: 'Yükseliş beklentisi: zarar primle sınırlı, kâr sınırsız.' },
    { k: 'lput', ad: 'Satım opsiyonu al (long put)', bac: [{ t: 'put', y: 1, K: 100, p: 5, n: 1 }], not: 'Düşüş beklentisi ya da sigorta: zarar primle sınırlı.' },
    { k: 'scall', ad: 'Alım opsiyonu sat (short call)', bac: [{ t: 'call', y: -1, K: 100, p: 6, n: 1 }], not: 'Primi peşin alırsın; fiyat çok yükselirse zarar sınırsız.' },
    { k: 'cov', ad: 'Örtülü alım (covered call)', bac: [{ t: 'hisse', y: 1, K: 0, p: 100, n: 1 }, { t: 'call', y: -1, K: 110, p: 3, n: 1 }], not: 'Elindeki hisseye karşı alım opsiyonu satarsın: prim gelir, yukarı potansiyel sınırlanır.' },
    { k: 'prot', ad: 'Korumalı satım (protective put)', bac: [{ t: 'hisse', y: 1, K: 0, p: 100, n: 1 }, { t: 'put', y: 1, K: 95, p: 3, n: 1 }], not: 'Hisseye sigorta: düşüşte zarar K’nin altında sabitlenir.' },
    { k: 'bull', ad: 'Boğa yayılımı (bull call spread)', bac: [{ t: 'call', y: 1, K: 95, p: 8, n: 1 }, { t: 'call', y: -1, K: 110, p: 2.5, n: 1 }], not: 'Ilımlı yükseliş: maliyeti düşük, kâr ve zarar sınırlı.' },
    { k: 'strad', ad: 'Uzun straddle', bac: [{ t: 'call', y: 1, K: 100, p: 6, n: 1 }, { t: 'put', y: 1, K: 100, p: 5, n: 1 }], not: 'Yön değil oynaklık beklentisi: fiyat hangi yöne sert giderse kazanırsın.' }
  ];

  /* ---------------- KİŞİSEL FİNANS ---------------- */
  V.BUTCE = [
    ['kira', 'Kira / yurt', 'ihtiyac', 7000], ['mutfak', 'Mutfak', 'ihtiyac', 3500], ['ulasim', 'Ulaşım', 'ihtiyac', 1200],
    ['fatura', 'Fatura ve telefon', 'ihtiyac', 900], ['disari', 'Dışarıda yemek, kafe', 'istek', 2200], ['eglence', 'Eğlence, abonelik', 'istek', 900],
    ['giyim', 'Giyim', 'istek', 1000], ['birikim', 'Birikim', 'birikim', 1300]
  ];
  V.GELIR = 18000;

  window.AXFIN = V;
})();
