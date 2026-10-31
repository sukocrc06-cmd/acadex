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
    return { gorulen: g.length, toplam: (n.hastalar || []).length, ort: ort };
  };
  V.saat = function (dk) { var h = Math.floor(dk / 60) % 24, m = dk % 60; return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; };
  return V;
});
