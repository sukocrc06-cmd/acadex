/* ==========================================================================
   ACADEX KIDS · içerik ve örnek okul (kids/assets/kids-veri.js), 10.11.2026
   İçerik (renkler, 12 konu, yaş dünyaları) ve tanıtım için ÖRNEK okul.
   Gerçek okul, sınıf ve öğrenciler Acadex yönetim panelinden gelir (kids-bulut.js);
   örnek okul (ORNEK-2026) yalnız bu tarayıcıda çalışır, sunucuya gitmez. W.KIDS_VERI
   ========================================================================== */
(function (W) {
  'use strict';
  var RENK = [
    { id: 'red', en: 'red', tr: 'kırmızı', hex: '#E5484D' },
    { id: 'yellow', en: 'yellow', tr: 'sarı', hex: '#FFD23F' },
    { id: 'blue', en: 'blue', tr: 'mavi', hex: '#4AA8FF' },
    { id: 'green', en: 'green', tr: 'yeşil', hex: '#4CC38A' },
    { id: 'orange', en: 'orange', tr: 'turuncu', hex: '#FF8A3D' },
    { id: 'purple', en: 'purple', tr: 'mor', hex: '#8E7CF0' }
  ];
  /* sayılar: her rakamın kendi rengi (kart, balon, nokta) */
  var SAYI = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'].map(function (en, i) {
    return { id: en, en: en, tr: ['bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz', 'on'][i], n: i + 1, hex: ['#E5484D', '#FF8A3D', '#E0A800', '#4CC38A', '#4AA8FF', '#8E7CF0', '#FF6FA5', '#12A3A3', '#C97A2B', '#5B6B8C'][i] };
  });
  /* 12 konu: Cambridge Pre A1 Starters temaları + MEB 2. sınıf temalarıyla hizalı */
  var KONU = [
    { id: 'colours', en: 'Colours', tr: 'Renkler', renk: '#FF9EB5', simge: 'gokkusagi', acik: true, rozet: 'Renk Ustası' },
    { id: 'numbers', en: 'Numbers', tr: 'Sayılar', renk: '#9BE0B4', simge: 'yildiz', acik: true, rozet: 'Sayı Kâşifi' },
    { id: 'animals', en: 'Animals', tr: 'Hayvanlar', renk: '#FFD98A', simge: 'lion', acik: true, rozet: 'Hayvan Dostu' },
    { id: 'family', en: 'Family', tr: 'Ailem', renk: '#B9C7FF', simge: 'family', acik: true, rozet: 'Aile Yıldızı' },
    { id: 'body', en: 'My Body', tr: 'Vücudum', renk: '#FFC2A1', simge: 'hands', acik: true, rozet: 'Beden Bilgini' },
    { id: 'food', en: 'Food', tr: 'Yiyecekler', renk: '#FFB3B3', simge: 'cake', acik: true, rozet: 'Minik Şef' },
    { id: 'toys', en: 'Toys', tr: 'Oyuncaklar', renk: '#A5DBFF', simge: 'teddy', acik: true, rozet: 'Oyun Ustası' },
    { id: 'clothes', en: 'Clothes', tr: 'Kıyafetler', renk: '#D9C2FF', simge: 'tshirt', acik: true, rozet: 'Giyinme Ustası' },
    { id: 'home', en: 'My Home', tr: 'Evim', renk: '#C7EBA0', simge: 'sofa', acik: true, rozet: 'Ev Kahramanı' },
    { id: 'school', en: 'School', tr: 'Okulum', renk: '#FFE08A', simge: 'bag', acik: true, rozet: 'Okul Yıldızı' },
    { id: 'weather', en: 'Weather', tr: 'Hava Durumu', renk: '#BDE8F2', simge: 'sunny', acik: true, rozet: 'Hava Gözlemcisi' },
    { id: 'feelings', en: 'Feelings', tr: 'Duygular', renk: '#FFC9E0', simge: 'happy', acik: true, rozet: 'Duygu Dedektifi' }
  ];
  /* yaş dünyaları: zorluk ve yazı miktarı buna göre değişir */
  var BANT = {
    minik: { ad: 'Minikler', yas: '3-4 yaş', renkSay: 3, sayiSay: 5, kelimeSay: 6, yazi: false, secenek: 3, tur: 4, cift: 3 },
    kasif: { ad: 'Kâşifler', yas: '5-6 yaş', renkSay: 6, sayiSay: 10, kelimeSay: 8, yazi: true, secenek: 4, tur: 5, cift: 4 },
    yildiz: { ad: 'Yıldızlar', yas: '7-10 yaş', renkSay: 6, sayiSay: 10, kelimeSay: 10, yazi: true, secenek: 5, tur: 6, cift: 6, kelimeKart: true }
  };
  var OKUL = {
    kod: 'ORNEK-2026', ad: 'Örnek Anaokulu', ornek: true,
    bugun: { konu: 'colours', not: 'Bugün okulda renkleri öğrendin!' },
    siniflar: [
      { id: 'papatya', ad: 'Papatyalar', bant: 'minik', renk: '#FFD23F', ogr: [['Defne', 'tavsan'], ['Ali', 'ayi'], ['Zeynep', 'kedi'], ['Kerem', 'civciv'], ['Elif', 'panda'], ['Mert', 'kurbaga']] },
      { id: 'ugur', ad: 'Uğur Böcekleri', bant: 'kasif', renk: '#E5484D', ogr: [['Asya', 'tilki'], ['Yusuf', 'kopek'], ['Nil', 'tavsan'], ['Aras', 'panda'], ['Ada', 'kedi'], ['Emir', 'ayi']] },
      { id: 'ikia', ad: '2-A Sınıfı', bant: 'yildiz', renk: '#4AA8FF', ogr: [['Duru', 'kedi'], ['Kaan', 'tilki'], ['Ela', 'civciv'], ['Deniz', 'kurbaga'], ['Mira', 'tavsan'], ['Can', 'kopek']] }
    ],
    sifre: ['kedi', 'elma'],   /* örnek okulda bütün çocukların resimli şifresi aynı */
    ogretmenSifre: '1234'      /* örnek okulun öğretmen şifresi (yalnız tanıtım) */
  };
  var SIFRE_RESIM = ['kedi', 'elma', 'top', 'balik', 'cicek', 'ay', 'araba', 'kus', 'cilek'];
  /* ---------- günün konusu ve haftalık plan (öğretmen seçer, çocuk ekranına yansır) ----------
     Tasarım sürümünde bu tarayıcıda saklanır: kids.plan.<okul>.<sinif> = {gunler: {'2026-11-10': 'colours' | ''}}
     '' = serbest gün. O güne kayıt yoksa örnek okulun varsayılan konusu geçerlidir. */
  function al(k, v) { try { var x = localStorage.getItem('kids.' + k); return x ? JSON.parse(x) : v; } catch (e) { return v; } }
  function koy(k, v) { try { localStorage.setItem('kids.' + k, JSON.stringify(v)); } catch (e) { } }
  function gunAnahtar(d) { d = d || new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function hafta(d) { d = d ? new Date(d) : new Date(); var g = (d.getDay() + 6) % 7, pzt = new Date(d.getFullYear(), d.getMonth(), d.getDate() - g), r = []; for (var i = 0; i < 5; i++) r.push(new Date(pzt.getFullYear(), pzt.getMonth(), pzt.getDate() + i)); return r; }
  function planAl(sinifId) { var p = al('plan.' + OKUL.kod + '.' + sinifId, null) || {}; p.gunler = p.gunler || {}; return p; }
  function planKoy(sinifId, gun, konuId) { var p = planAl(sinifId); p.gunler[gun] = konuId; koy('plan.' + OKUL.kod + '.' + sinifId, p); return p; }
  function gunKonu(sinifId, d) { var p = planAl(sinifId), g = gunAnahtar(d); return g in p.gunler ? p.gunler[g] : (g === gunAnahtar() ? OKUL.bugun.konu : ''); }
  /* avatar dolabı: toplam yıldızla açılır; bas ve yuz yuvaları */
  var GIYSI = [
    { id: 'fiyonk', ad: 'Fiyonk', yuva: 'bas', yildiz: 3 }, { id: 'gozluk', ad: 'Gözlük', yuva: 'yuz', yildiz: 6 }, { id: 'sapka', ad: 'Parti şapkası', yuva: 'bas', yildiz: 9 },
    { id: 'gunes', ad: 'Güneş gözlüğü', yuva: 'yuz', yildiz: 12 }, { id: 'kulaklik', ad: 'Kulaklık', yuva: 'bas', yildiz: 16 }, { id: 'tac', ad: 'Taç', yuva: 'bas', yildiz: 20 },
    /* tema giysileri: o konunun adası bitince açılır */
    { id: 'kulak', ad: 'Kedi kulağı', yuva: 'bas', tema: 'animals' }, { id: 'cicektac', ad: 'Çiçek taç', yuva: 'bas', tema: 'family' }, { id: 'bant', ad: 'Ter bandı', yuva: 'bas', tema: 'body' },
    { id: 'asci', ad: 'Aşçı şapkası', yuva: 'bas', tema: 'food' }, { id: 'pervane', ad: 'Pervaneli şapka', yuva: 'bas', tema: 'toys' }, { id: 'bere', ad: 'Bere', yuva: 'bas', tema: 'clothes' },
    { id: 'maske', ad: 'Uyku maskesi', yuva: 'yuz', tema: 'home' }, { id: 'kep', ad: 'Mezuniyet kepi', yuva: 'bas', tema: 'school' }, { id: 'semsiye', ad: 'Şemsiye şapka', yuva: 'bas', tema: 'weather' },
    { id: 'yanak', ad: 'Yıldız yanaklar', yuva: 'yuz', tema: 'feelings' }
  ];
  /* bir kelimeyi (renk ya da sayı) bütün konularda bul: öğretmen ve veli ekranlarındaki "zorlandığı kelime" */
  /* kelime kimliğinden kelime: renk, sayı ya da herhangi bir tema paketi (kids-konu yüklendikten sonra) */
  function ogeBul(id) {
    var x = RENK.concat(SAYI).filter(function (o) { return o.id === id; }); if (x[0]) return x[0];
    var K = W.KIDS_KONU; if (!K) return null;
    for (var i = 0; i < K.PAKET.length; i++) { var y = K.al(K.PAKET[i]).ogeler(BANT.yildiz).filter(function (o) { return o.id === id; })[0]; if (y) return y; }
    return null;
  }
  /* kelimenin hangi konudan olduğu */
  function ogeKonu(id) { var K = W.KIDS_KONU; if (!K) return null; for (var i = 0; i < K.PAKET.length; i++) if (K.al(K.PAKET[i]).ogeler(BANT.yildiz).some(function (o) { return o.id === id; })) return K.PAKET[i]; return null; }
  function konuBul(id) { for (var i = 0; i < KONU.length; i++) if (KONU[i].id === id) return KONU[i]; return null; }
  W.KIDS_VERI = { SAYI: SAYI, GIYSI: GIYSI, ogeBul: ogeBul, ogeKonu: ogeKonu, RENK: RENK, KONU: KONU, BANT: BANT, OKUL: OKUL, SIFRE_RESIM: SIFRE_RESIM, al: al, koy: koy, gunAnahtar: gunAnahtar, hafta: hafta, planAl: planAl, planKoy: planKoy, gunKonu: gunKonu, konuBul: konuBul };
})(window);
