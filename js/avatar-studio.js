/* ==========================================================================
   Acadex · Avatar stüdyosu
   Bitmoji tarzı kişisel avatar editörü (DiceBear "avataaars", Pablo Stanley,
   ticari kullanım dahil ücretsiz).

   - Ayarlar → "Avatarını oluştur" eski "Emoji avatar" penceresinin yerine geçer
     (window.openAvatarBuilder bu dosyada yeniden tanımlanır).
   - Avatar tarayıcıda DiceBear kütüphanesiyle çizilir; kütüphane yüklenemezse
     DiceBear'ın kendi sunucusu (api.dicebear.com) kullanılır.
   - Kaydet: avatar 512×512 PNG'ye çevrilir ve Supabase Storage'daki "avatars"
     bucket'ına (<kullanıcı id>/avatar-studio.png) yüklenir. Seçimler,
     profiles.avatar_url adresinin sonundaki "acx" parametresinde saklanır;
     veritabanında yeni sütun gerekmez.
   - İfade seti: aynı avatarın mutlu / düşünceli / şaşkın ... halleri.
     Acadia önerisinde ve başarı bildirimlerinde sticker olarak görünür.
   - Rozet parçaları: user_achievements'taki rozetlerle açılan Acadex'e özel
     parçalar (kep, kulaklık, kalem, rozet, çerçeve, arka plan).
   - Canlı kart: avatar imlece / telefon eğimine göre hafifçe döner ve göz kırpar.
   - Ruh hali: Pomodoro odak turunda odaklanmış, yeni bitmiş sınavın puanına göre
     gururlu / mutlu / düşünceli (2 saat), bugün çalıştıysan mutlu, uzun aradan
     sonra "seni özledim".
   - Öğrenci kartı: avatar + ad + bölümle indirilebilir / paylaşılabilir PNG.
   - Kombinler: yüzü değiştirmeden kıyafet + aksesuar + zemin setleri.
   - Dolabım: 3 kayıtlı görünüş; tarayıcıda ve avatars/<id>/avatar-dolap.json'da.
   - Renkler: her paletin yanında renk çarkı ve "son kullandıkların".
   - Bölüm parçaları (xDept): steteskop, terazi, baret, kod rozeti...; kendi
     bölümüne uyan başta önerilir.
   - Acadia: senin mesajlarının yanında avatarın; cevap beklerken düşünür,
     cevap gelince göz kırpar. Kaydedince sayfadaki eski avatarlar anında değişir.
   ========================================================================== */
(function () {
  'use strict';

  var CDN_CORE = 'https://cdn.jsdelivr.net/npm/@dicebear/core@9.2.2/+esm';
  var CDN_STYLE = 'https://cdn.jsdelivr.net/npm/@dicebear/avataaars@9.2.2/+esm';
  var API = 'https://api.dicebear.com/9.x/avataaars/svg';
  var FILE = 'avatar-studio.png';

  /* ---------- seçenekler (Türkçe adlarıyla) ---------- */
  var SKIN = [['ffdbb4', 'açık'], ['edb98a', 'buğday'], ['f8d25c', 'sarı'], ['fd9841', 'bronz'], ['d08b5b', 'esmer'], ['ae5d29', 'koyu'], ['614335', 'çok koyu']];
  var HAIR_C = [['2c1b18', 'siyah'], ['4a312c', 'koyu kahve'], ['724133', 'kahve'], ['a55728', 'kestane'], ['b58143', 'açık kahve'], ['d6b370', 'sarı'], ['ecdcbf', 'platin'], ['c93305', 'kızıl'], ['e8e1e1', 'gri'], ['f59797', 'pembe']];
  var CLOTH_C = [['262e33', 'siyah'], ['3c4f5c', 'antrasit'], ['929598', 'gri'], ['e6e6e6', 'açık gri'], ['ffffff', 'beyaz'], ['25557c', 'lacivert'], ['5199e4', 'mavi'], ['65c9ff', 'açık mavi'], ['b1e2ff', 'buz mavisi'], ['a7ffc4', 'mint'], ['ffffb1', 'limon'], ['ffafb9', 'pudra'], ['ff488e', 'pembe'], ['ff5c5c', 'kırmızı']];
  var HAT_C = CLOTH_C.concat([['ffdeb5', 'bej']]);
  var BG = [['b6e3f4', 'gök'], ['c0aede', 'lila'], ['d1d4f9', 'lavanta'], ['ffd5dc', 'pembe'], ['ffdfbf', 'şeftali'], ['fff1b8', 'fosfor'], ['e7f6ec', 'nane'], ['dbe6ff', 'acadex mavisi'], ['0d1838', 'gece'], ['transparent', 'şeffaf']];
  var TOPS = [
    ['Uzun', [['straight01', 'düz uzun'], ['straight02', 'düz uzun 2'], ['straightAndStrand', 'perçemli'], ['longButNotTooLong', 'omuz boyu'], ['bob', 'küt'], ['bun', 'topuz'], ['curly', 'kıvırcık'], ['curvy', 'dalgalı'], ['bigHair', 'gür'], ['miaWallace', 'kâküllü'], ['frida', 'örgülü taç'], ['fro', 'afro'], ['froBand', 'bantlı afro'], ['dreads', 'rasta'], ['shaggy', 'katlı'], ['shaggyMullet', 'mullet'], ['frizzle', 'kabarık']]],
    ['Kısa', [['shortFlat', 'kısa düz'], ['shortRound', 'kısa yuvarlak'], ['shortWaved', 'kısa dalgalı'], ['shortCurly', 'kısa kıvırcık'], ['theCaesar', 'sezar'], ['theCaesarAndSidePart', 'yandan ayrık'], ['sides', 'yanlar'], ['shavedSides', 'yanları kazınmış'], ['dreads01', 'kısa rasta'], ['dreads02', 'kısa rasta 2'], ['', 'saçsız']]],
    ['Örtü ve şapka', [['hijab', 'başörtüsü'], ['turban', 'türban'], ['hat', 'şapka'], ['winterHat1', 'bere'], ['winterHat02', 'ponponlu bere'], ['winterHat03', 'kulaklı bere'], ['winterHat04', 'kar beresi']]]
  ];
  var COVERS = { hijab: 1, turban: 1, hat: 1, winterHat1: 1, winterHat02: 1, winterHat03: 1, winterHat04: 1 };
  var EYES = [['default', 'normal'], ['happy', 'mutlu'], ['wink', 'göz kırpan'], ['squint', 'kısık'], ['side', 'yana bakan'], ['surprised', 'şaşkın'], ['closed', 'kapalı'], ['hearts', 'kalpli'], ['eyeRoll', 'devirmiş'], ['winkWacky', 'şaşı kırpan']];
  var BROWS = [['defaultNatural', 'doğal'], ['default', 'ince'], ['flatNatural', 'düz'], ['raisedExcitedNatural', 'kalkık'], ['raisedExcited', 'çok kalkık'], ['upDownNatural', 'tek kalkık'], ['sadConcernedNatural', 'endişeli'], ['frownNatural', 'çatık'], ['angryNatural', 'kızgın'], ['unibrowNatural', 'bitişik']];
  var MOUTH = [['smile', 'gülümseme'], ['default', 'normal'], ['twinkle', 'tatlı'], ['tongue', 'dil çıkaran'], ['serious', 'ciddi'], ['concerned', 'endişeli'], ['disbelief', 'inanamayan'], ['sad', 'üzgün'], ['eating', 'yiyor'], ['grimace', 'sırıtan']];
  var BEARD = [['', 'yok'], ['beardLight', 'hafif sakal'], ['beardMedium', 'sakal'], ['beardMajestic', 'gür sakal'], ['moustacheFancy', 'kıvrık bıyık'], ['moustacheMagnum', 'kalın bıyık']];
  var GLASS = [['', 'yok'], ['prescription01', 'numaralı'], ['prescription02', 'numaralı 2'], ['round', 'yuvarlak'], ['wayfarers', 'kemik'], ['sunglasses', 'güneş'], ['kurt', 'büyük güneş']];
  var CLOTH = [['hoodie', 'kapüşonlu'], ['shirtCrewNeck', 'tişört'], ['shirtVNeck', 'v yaka'], ['shirtScoopNeck', 'geniş yaka'], ['graphicShirt', 'baskılı tişört'], ['collarAndSweater', 'yakalı kazak'], ['blazerAndShirt', 'ceket gömlek'], ['blazerAndSweater', 'ceket kazak'], ['overall', 'salopet']];

  var EXPR = [
    { k: 'mutlu', label: 'mutlu', eyes: 'happy', eyebrows: 'defaultNatural', mouth: 'smile' },
    { k: 'dusunceli', label: 'düşünceli', eyes: 'side', eyebrows: 'upDownNatural', mouth: 'serious' },
    { k: 'saskin', label: 'şaşkın', eyes: 'surprised', eyebrows: 'raisedExcitedNatural', mouth: 'disbelief' },
    { k: 'kirpan', label: 'göz kırpan', eyes: 'wink', eyebrows: 'defaultNatural', mouth: 'twinkle' },
    { k: 'heyecanli', label: 'heyecanlı', eyes: 'hearts', eyebrows: 'raisedExcited', mouth: 'smile' }
  ];
  var MOODS = {
    mutlu: { eyes: 'happy', eyebrows: 'defaultNatural', mouth: 'smile' },
    ozlemis: { eyes: 'default', eyebrows: 'sadConcernedNatural', mouth: 'smile' },
    odak: { eyes: 'default', eyebrows: 'flatNatural', mouth: 'serious' },
    gurur: { eyes: 'happy', eyebrows: 'raisedExcitedNatural', mouth: 'smile' },
    dusunceli: { eyes: 'side', eyebrows: 'sadConcernedNatural', mouth: 'serious' },
    kirpan: { eyes: 'wink', eyebrows: 'defaultNatural', mouth: 'twinkle' },
    saskin: { eyes: 'surprised', eyebrows: 'raisedExcitedNatural', mouth: 'disbelief' }
  };
  var BLINK = { eyes: 'closed' };

  /* rozetle açılan Acadex parçaları (çizimler aşağıda, 280×280 avatar düzleminde) */
  var EXTRAS = [
    { k: 'kep', slot: 'xHead', label: 'mezuniyet kepi', need: 'first_exam' },
    { k: 'kulaklik', slot: 'xHead', label: 'kulaklık', need: 'streak_7' },
    { k: 'kalem', slot: 'xEar', label: 'kulak arkası kalem', need: 'first_summary' },
    { k: 'rozet', slot: 'xChest', label: 'Acadex rozeti', need: 'first_upload' },
    { k: 'altin', slot: 'xFrame', label: 'altın çerçeve', need: 'perfect_score' },
    { k: 'yildiz', slot: 'xBg', label: 'yıldızlı gece', need: 'streak_30' }
  ];

  /* bölüme göre parçalar: herkese açık, kendi bölümün başta önerilir */
  var DEPTX = [
    { k: 'kod', label: 'kod rozeti', fac: 'Bilişim · YBS', re: /bilgisayar|computer|yaz[ıi]l[ıi]m|software|bili[şs]im|information|ybs|veri|data/i },
    { k: 'dunya', label: 'dünya rozeti', fac: 'Uluslararası', re: /uluslararas|international|d[ıi][şs] ticaret|trade|ili[şs]kiler|relations/i },
    { k: 'grafik', label: 'yükselen grafik', fac: 'Finans · Bankacılık', re: /bankac[ıi]l[ıi]k|banking|finans|finance|muhasebe|account|ekonomi|economics|iktisat/i },
    { k: 'steteskop', label: 'steteskop', fac: 'Tıp · Sağlık', re: /t[ıi]p|medic|hem[şs]ire|nurs|sa[ğg]l[ıi]k|health|eczac|pharm|di[şs] hek|dent|veteriner|vet/i },
    { k: 'terazi', label: 'adalet terazisi', fac: 'Hukuk', re: /hukuk|law|adalet/i },
    { k: 'baret', label: 'baret', fac: 'Mühendislik · Mimarlık', re: /m[üu]hendis|engineer|mimar|architect|in[şs]aat|civil/i },
    { k: 'elma', label: 'öğretmen elması', fac: 'Eğitim', re: /e[ğg]itim|education|[öo][ğg]retmen|teach|pedagoj/i },
    { k: 'kravat', label: 'kravat', fac: 'İşletme · Yönetim', re: /i[şs]letme|business|y[öo]netim|management|pazarlama|marketing/i }
  ];
  var deptOf = function (d) { d = String(d || ''); for (var i = 0; i < DEPTX.length; i++) if (DEPTX[i].re.test(d)) return DEPTX[i].k; return ''; };
  /* hazır kombinler: yüzüne, tenine, saçına dokunmaz; sadece üstünü, aksesuarı ve zemini değiştirir */
  var OUTFITS = [
    { k: 'sinav', label: 'Sınav haftası', note: 'kapüşonlu, gözlük, fosfor zemin', set: { clothing: 'hoodie', clothesColor: '3c4f5c', accessories: 'prescription02', accessoriesColor: '262e33', bg: 'fff1b8' } },
    { k: 'kutuphane', label: 'Kütüphane', note: 'yakalı kazak, yuvarlak gözlük', set: { clothing: 'collarAndSweater', clothesColor: '25557c', accessories: 'round', accessoriesColor: '3c4f5c', bg: 'd1d4f9' } },
    { k: 'sunum', label: 'Sunum günü', note: 'ceket gömlek, acadex mavisi', set: { clothing: 'blazerAndShirt', clothesColor: '262e33', bg: 'dbe6ff' } },
    { k: 'kampus', label: 'Kampüs', note: 'baskılı tişört, gök mavisi', set: { clothing: 'graphicShirt', clothesColor: '5199e4', clothingGraphic: 'bear', bg: 'b6e3f4' } },
    { k: 'gece', label: 'Gece çalışması', note: 'siyah kapüşonlu, gece zemin', set: { clothing: 'hoodie', clothesColor: '262e33', accessories: 'prescription01', accessoriesColor: '262e33', bg: '0d1838' } },
    { k: 'kis', label: 'Kış sabahı', note: 'ponponlu bere, açık gri', set: { top: 'winterHat02', hatColor: 'ff5c5c', clothing: 'hoodie', clothesColor: 'e6e6e6', bg: 'e7f6ec' } },
    { k: 'bahar', label: 'Bahar şenliği', note: 'geniş yaka, pudra', set: { clothing: 'shirtScoopNeck', clothesColor: 'ffafb9', bg: 'ffdfbf' } },
    { k: 'spor', label: 'Spor', note: 'tişört, kırmızı', set: { clothing: 'shirtCrewNeck', clothesColor: 'ff5c5c', bg: 'ffd5dc' } }
  ];

  var PRESETS = {
    kiz: { top: 'straight01', hairColor: '4a312c', eyes: 'default', eyebrows: 'defaultNatural', mouth: 'smile', facialHair: '', accessories: '', clothing: 'shirtScoopNeck', clothesColor: 'ff488e', bg: 'ffd5dc' },
    erkek: { top: 'shortFlat', hairColor: '2c1b18', eyes: 'default', eyebrows: 'defaultNatural', mouth: 'smile', facialHair: '', accessories: '', clothing: 'hoodie', clothesColor: '25557c', bg: 'b6e3f4' }
  };
  var DEF = { skinColor: 'edb98a', top: 'shortFlat', hairColor: '2c1b18', hatColor: '25557c', eyes: 'default', eyebrows: 'defaultNatural', mouth: 'smile', facialHair: '', facialHairColor: '2c1b18', accessories: '', accessoriesColor: '262e33', clothing: 'hoodie', clothesColor: '25557c', clothingGraphic: 'bear', bg: 'b6e3f4', xHead: '', xEar: '', xChest: '', xFrame: '', xBg: '', xDept: '' };

  var KEYS = Object.keys(DEF);
  var assign = function (a) { for (var i = 1; i < arguments.length; i++) { var b = arguments[i]; if (b) for (var k in b) if (Object.prototype.hasOwnProperty.call(b, k)) a[k] = b[k]; } return a; };
  var clean = function (c) { var o = {}; KEYS.forEach(function (k) { o[k] = c && typeof c[k] === 'string' ? c[k] : DEF[k]; }); return o; };
  var pick = function (list) { return list[Math.floor(Math.random() * list.length)]; };

  /* ---------- seçimleri adreste taşımak ---------- */
  var b64e = function (s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  var b64d = function (s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); };
  var encodeCfg = function (c) { var short = {}; KEYS.forEach(function (k) { if (c[k] !== DEF[k]) short[k] = c[k]; }); return b64e(JSON.stringify(short)); };
  var cfgFromUrl = function (url) {
    if (!url) return null;
    var m = String(url).match(/[?&]acx=([A-Za-z0-9_-]+)/);
    if (!m) return null;
    try { return clean(assign({}, DEF, JSON.parse(b64d(m[1])))); } catch (e) { return null; }
  };

  /* ---------- çizim: önce kütüphane, olmazsa DiceBear sunucusu ---------- */
  var lib = null, libP = null;
  var loadLib = function () {
    if (libP) return libP;
    libP = Promise.all([import(CDN_CORE), import(CDN_STYLE)]).then(function (m) {
      if (!m[0] || typeof m[0].createAvatar !== 'function') throw new Error('dicebear core');
      lib = { create: m[0].createAvatar, style: m[1] };
      return lib;
    }).catch(function (e) { if (window.console) console.warn('Avatar kütüphanesi yüklenemedi, DiceBear sunucusu kullanılacak.', e); lib = false; return false; });
    return libP;
  };
  var opts = function (c) {
    return {
      seed: 'acadex', skinColor: [c.skinColor], nose: ['default'],
      eyes: [c.eyes], eyebrows: [c.eyebrows], mouth: [c.mouth],
      top: [c.top || 'shortFlat'], topProbability: c.top ? 100 : 0,
      hairColor: [c.hairColor], hatColor: [c.hatColor],
      facialHair: [c.facialHair || 'beardLight'], facialHairProbability: c.facialHair ? 100 : 0, facialHairColor: [c.facialHairColor],
      accessories: [c.accessories || 'round'], accessoriesProbability: c.accessories ? 100 : 0, accessoriesColor: [c.accessoriesColor],
      clothing: [c.clothing], clothesColor: [c.clothesColor], clothingGraphic: [c.clothingGraphic],
      /* özel arka plan ya da çerçeve varsa DiceBear şeffaf çizer, zemini biz koyarız */
      backgroundColor: [c.xBg ? 'transparent' : c.bg], backgroundType: ['solid']
    };
  };
  var apiUrl = function (c) {
    var o = opts(c), q = [];
    Object.keys(o).forEach(function (k) { var v = o[k]; q.push(encodeURIComponent(k) + '=' + encodeURIComponent(Array.isArray(v) ? v.join(',') : String(v))); });
    return API + '?' + q.join('&');
  };
  var hasExtras = function (c) { return !!(c.xHead || c.xEar || c.xChest || c.xFrame || c.xBg || c.xDept); };

  /* Acadex parçaları — avataaars düzleminde baş merkezi (140, 92), yarıçap 56; göğüs y≈200 */
  var STARS = [[28, 34, 3], [62, 18, 2], [246, 26, 3], [262, 66, 2], [22, 120, 2], [256, 140, 3], [36, 196, 2], [248, 214, 2], [204, 16, 2], [90, 248, 2], [196, 252, 3], [14, 74, 2]];
  var EXTRA_BG = {
    yildiz: '<rect width="280" height="280" fill="#0D1838"/><circle cx="140" cy="120" r="150" fill="#1A2A5C" opacity=".55"/>' +
      STARS.map(function (s) { return '<circle cx="' + s[0] + '" cy="' + s[1] + '" r="' + s[2] + '" fill="' + (s[2] > 2 ? '#FFD966' : '#FFFFFF') + '"/>'; }).join('') +
      '<path d="M226 92 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" fill="#FFD966"/><path d="M48 156 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#FFFFFF"/>'
  };
  var EXTRA_FG = {
    kep: '<g transform="rotate(-6 140 34)"><path d="M98 40 V58 Q140 76 182 58 V40 Z" fill="#24366E"/><path d="M140 8 L216 32 L140 56 L64 32 Z" fill="#1A2A5C"/><path d="M140 8 L216 32 L140 56 L64 32 Z" fill="none" stroke="#3A4F8F" stroke-width="2"/><circle cx="140" cy="32" r="5" fill="#FFD966"/><path d="M140 32 L200 44 L200 76" fill="none" stroke="#FFD966" stroke-width="3.5" stroke-linecap="round"/><path d="M194 74 h12 l-2 18 h-8 z" fill="#FFD966"/></g>',
    kulaklik: '<path d="M78 108 C74 18 206 18 202 108" fill="none" stroke="#1A2A5C" stroke-width="10" stroke-linecap="round"/><path d="M78 108 C74 18 206 18 202 108" fill="none" stroke="#3A4F8F" stroke-width="4" stroke-linecap="round"/><rect x="62" y="86" width="26" height="44" rx="12" fill="#2F6BFF" stroke="#1A2A5C" stroke-width="4"/><rect x="192" y="86" width="26" height="44" rx="12" fill="#2F6BFF" stroke="#1A2A5C" stroke-width="4"/>',
    kalem: '<g transform="rotate(28 214 78)"><rect x="207" y="30" width="14" height="70" rx="2" fill="#FFD966" stroke="#1A2A5C" stroke-width="3"/><rect x="207" y="24" width="14" height="10" rx="2" fill="#F2B8B0" stroke="#1A2A5C" stroke-width="3"/><path d="M207 100 L221 100 L214 118 Z" fill="#F1D6A8" stroke="#1A2A5C" stroke-width="3" stroke-linejoin="round"/><path d="M211.5 111 L216.5 111 L214 118 Z" fill="#1A2A5C"/></g>',
    rozet: '<circle cx="102" cy="230" r="15" fill="#2F6BFF" stroke="#FFFFFF" stroke-width="4"/><path d="M102 220 l3 7 7 .5 -5.4 4.6 1.8 7 -6.4 -4 -6.4 4 1.8 -7 -5.4 -4.6 7 -.5z" fill="#FFD966"/>',
    /* bölüm parçaları: göğüs rozetleri sağ göğüste (178, 232), sol taraftaki Acadex rozetiyle çakışmaz */
    kod: '<circle cx="178" cy="232" r="15" fill="#0D1838" stroke="#FFFFFF" stroke-width="4"/><path d="M171 226 L165 232 L171 238 M185 226 L191 232 L185 238 M180 224 L176 240" fill="none" stroke="#7FE3B5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    dunya: '<circle cx="178" cy="232" r="15" fill="#2F6BFF" stroke="#FFFFFF" stroke-width="4"/><ellipse cx="178" cy="232" rx="6" ry="13" fill="none" stroke="#DCE6FF" stroke-width="2"/><path d="M165 232 H191 M167 225 H189 M167 239 H189" stroke="#DCE6FF" stroke-width="2"/><path d="M172 222 C176 226 170 230 176 233 C181 235 178 240 182 242" fill="none" stroke="#7FE3B5" stroke-width="3" stroke-linecap="round"/>',
    grafik: '<rect x="161" y="218" width="34" height="28" rx="6" fill="#FFFFFF" stroke="#1A2A5C" stroke-width="3"/><path d="M166 240 L174 233 L180 236 L190 225" fill="none" stroke="#1E8A55" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M184 224 H190 V230" fill="none" stroke="#1E8A55" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    steteskop: '<path d="M108 178 C100 206 110 230 128 240 C136 244 142 247 145 252" fill="none" stroke="#2B3A55" stroke-width="5" stroke-linecap="round"/><path d="M172 178 C180 206 170 228 154 238 C149 242 146 246 145 252" fill="none" stroke="#2B3A55" stroke-width="5" stroke-linecap="round"/><circle cx="108" cy="178" r="3.5" fill="#C9D1E1"/><circle cx="172" cy="178" r="3.5" fill="#C9D1E1"/><circle cx="145" cy="261" r="10" fill="#DCE2EE" stroke="#2B3A55" stroke-width="4"/><circle cx="145" cy="261" r="3.5" fill="#2B3A55"/>',
    terazi: '<circle cx="178" cy="232" r="15" fill="#FFF3C2" stroke="#FFFFFF" stroke-width="4"/><path d="M178 222 V242 M172 243 H184 M168 227 H188" stroke="#8A6A10" stroke-width="2.4" stroke-linecap="round"/><path d="M165 235 L168 227 L171 235 Z M185 235 L188 227 L191 235 Z" fill="#E8B931" stroke="#8A6A10" stroke-width="1.6" stroke-linejoin="round"/>',
    baret: '<g transform="translate(0 -5)"><path d="M80 72 C80 18 200 18 200 72 Z" fill="#F2C14E" stroke="#8A6A10" stroke-width="3"/><path d="M128 26 C126 44 126 58 128 72 M152 26 C154 44 154 58 152 72" fill="none" stroke="#D9A22E" stroke-width="6" stroke-linecap="round"/><path d="M66 72 H214 Q220 84 206 86 H74 Q60 84 66 72 Z" fill="#F2C14E" stroke="#8A6A10" stroke-width="3" stroke-linejoin="round"/></g>',
    elma: '<path d="M178 228 C170 220 160 226 162 236 C164 246 172 250 178 247 C184 250 192 246 194 236 C196 226 186 220 178 228 Z" fill="#E5484D" stroke="#FFFFFF" stroke-width="3"/><path d="M178 228 C178 222 180 218 183 216" fill="none" stroke="#6B3E1E" stroke-width="2.4" stroke-linecap="round"/><path d="M182 220 C188 216 192 218 192 222 C187 224 184 223 182 220 Z" fill="#3FAE6A"/>',
    kravat: '<path d="M133 184 H147 L144 197 H136 Z" fill="#B4351F" stroke="#7A2314" stroke-width="2" stroke-linejoin="round"/><path d="M136 197 H144 L151 248 L140 262 L129 248 Z" fill="#C9483B" stroke="#7A2314" stroke-width="2" stroke-linejoin="round"/><path d="M138 210 L148 220 M135 226 L149 240 M133 242 L143 252" stroke="#E58C8A" stroke-width="3" stroke-linecap="round"/>',
    altin: '<rect x="7" y="7" width="266" height="266" rx="30" fill="none" stroke="#E8B931" stroke-width="12"/><rect x="15" y="15" width="250" height="250" rx="24" fill="none" stroke="#FFF3C2" stroke-width="3"/><path d="M30 14 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#FFF3C2"/><path d="M250 246 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#FFF3C2"/>'
  };
  /* DiceBear SVG'sini Acadex katmanlarıyla birleştir; sticker'da zemin ve çerçeve olmaz */
  var compose = function (svg, c, sticker) {
    if (!hasExtras(c)) return svg;
    var bg = !sticker && c.xBg && EXTRA_BG[c.xBg] ? EXTRA_BG[c.xBg] : '';
    var fg = [c.xDept, c.xHead, c.xEar, c.xChest].concat(sticker ? [] : [c.xFrame]).filter(Boolean).map(function (k) { return EXTRA_FG[k] || ''; }).join('');
    var inner = String(svg).replace(/^\s*<\?xml[^>]*>\s*/, '');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280" width="280" height="280">' + bg + inner + fg + '</svg>';
  };
  var forView = function (c, sticker) { return sticker ? assign({}, c, { bg: 'transparent', xBg: '', xFrame: '' }) : c; };
  var svgOf = function (c, sticker) { if (!lib) return null; var v = forView(c, sticker); return compose(lib.create(lib.style, opts(v)).toString(), v, sticker); };
  var dataUri = function (svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); };
  var srcOf = function (c, sticker) {
    if (lib) { try { return dataUri(svgOf(c, sticker)); } catch (e) { /* düşerse sunucu */ } }
    return apiUrl(forView(c, sticker));
  };
  /* sunucu modunda parçalı görüntü için SVG'yi indirip birleştir */
  var srcAsync = function (c, sticker) {
    if (lib || !hasExtras(forView(c, sticker))) return Promise.resolve(srcOf(c, sticker));
    var v = forView(c, sticker);
    return fetch(apiUrl(v)).then(function (r) { return r.text(); }).then(function (t) { return dataUri(compose(t, v, sticker)); }).catch(function () { return apiUrl(v); });
  };
  var withExpr = function (c, ex) { return assign({}, c, { eyes: ex.eyes || c.eyes, eyebrows: ex.eyebrows || c.eyebrows, mouth: ex.mouth || c.mouth }); };

  var loadImg = function (src) {
    return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { rej(new Error('img')); }; im.src = src; });
  };
  /* SVG'yi tuvale çiz (kütüphane yoksa SVG'yi sunucudan al) */
  var svgText = function (c) {
    if (lib) return Promise.resolve(svgOf(c));
    return fetch(apiUrl(c)).then(function (r) { if (!r.ok) throw new Error('svg ' + r.status); return r.text(); }).then(function (t) { return compose(t, c); });
  };
  var canvasBlob = function (cv) { return new Promise(function (res, rej) { cv.toBlob(function (b) { b ? res(b) : rej(new Error('png')); }, 'image/png'); }); };
  var pngOf = function (c, size) {
    size = size || 512;
    return svgText(c).then(function (svg) { return loadImg(dataUri(svg)); }).then(function (im) {
      var cv = document.createElement('canvas'); cv.width = size; cv.height = size;
      cv.getContext('2d').drawImage(im, 0, 0, size, size);
      return canvasBlob(cv);
    });
  };

  /* ---------- global erişim (dashboard.js'teki let/const'lar) ---------- */
  var g = function (name) { try { return (0, eval)(name); } catch (e) { return undefined; } };
  var alertMsg = function (type, msg) { var f = window.showDashboardAlert || g('showDashboardAlert'); if (typeof f === 'function') f(type, msg); };
  var profile = function () { return g('currentUserProfile') || null; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); };
  var ls = {
    get: function (k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* özel pencere vb. */ } }
  };
  var reduce = function () { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); };
  var today = function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
  var dayDiff = function (a, b) { var pa = a.split('-'), pb = b.split('-'); return Math.round((new Date(pb[0], pb[1] - 1, pb[2]) - new Date(pa[0], pa[1] - 1, pa[2])) / 864e5); };

  /* ---------- stil ---------- */
  var css = [
    '.avs-back{position:fixed;inset:0;z-index:1000000;background:rgba(13,24,56,0.55);display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box}',
    '.avs-back[hidden]{display:none}',
    '.avs{position:relative;width:min(980px,100%);height:min(740px,calc(100vh - 36px));display:flex;flex-direction:column;background:#FFFEFB;color:#0D1838;border-radius:8px;box-shadow:0 1px 0 #E6E2D6,0 40px 80px -40px rgba(13,24,56,0.7);overflow:hidden;font-family:"Instrument Sans",system-ui,sans-serif}',
    '.avs-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding:22px 26px 14px;border-bottom:1px solid #E6E2D6}',
    '.avs-eyb{display:block;font-family:Caveat,"Segoe Print",cursive;font-size:22px;color:#2F6BFF;transform:rotate(-2deg);transform-origin:0 100%;line-height:1}',
    '.avs-head h2{margin:4px 0 0;font-family:"Bricolage Grotesque",system-ui,sans-serif;font-size:28px;font-weight:800;letter-spacing:-0.02em;line-height:1.05}',
    '.avs-x{border:0;background:none;font-size:28px;line-height:1;color:#5B6787;cursor:pointer;width:44px;height:44px;border-radius:50%}',
    '.avs-x:hover{background:#EEF1F6}',
    '.avs-body{display:grid;grid-template-columns:300px minmax(0,1fr);min-height:0;flex:1}',
    '.avs-side{padding:20px 24px;border-right:1px solid #E6E2D6;display:flex;flex-direction:column;gap:14px;overflow-y:auto}',
    '.avs-prev{position:relative;width:212px;height:212px;margin:0 auto}',
    '.avs-prev .avs-live{width:100%;height:100%;border-radius:28px;box-shadow:0 1px 0 #DDE2EC,0 26px 36px -26px rgba(13,24,56,0.6)}',
    '.avs-prev img{width:100%;height:100%;display:block;border-radius:28px;background:#F3F5FA}',
    '.avs-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}',
    '.avs-chip{border:1.6px solid #1A2A5C;background:#FFFFFF;color:#1A2A5C;border-radius:999px;padding:7px 14px;min-height:40px;font:inherit;font-weight:600;font-size:14px;cursor:pointer}',
    '.avs-chip:hover{background:#FFF3C2}.avs-chip:disabled{opacity:.4;cursor:default;background:#FFFFFF}',
    '.avs-chip.ghost{border-color:#C9D1E1;color:#33405F}',
    '.avs-lbl{font-family:Caveat,"Segoe Print",cursive;font-size:21px;color:#5B6787;line-height:1}',
    '.avs-ex{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}',
    '.avs-ex figure{margin:0;text-align:center}',
    '.avs-ex img{width:100%;aspect-ratio:1;display:block}',
    '.avs-ex figcaption{font-size:11px;color:#5B6787;margin-top:2px;line-height:1.2}',
    '.avs-dl{border:1.6px solid #1A2A5C;background:#FFFFFF;color:#1A2A5C;border-radius:999px;padding:9px 14px;min-height:42px;font:inherit;font-weight:600;font-size:14px;cursor:pointer;flex:1}',
    '.avs-dl:hover{background:#EEF1F6}.avs-dl:disabled{opacity:.55;cursor:default}',
    '.avs-main{display:flex;flex-direction:column;min-width:0;min-height:0}',
    '.avs-tabs{display:flex;flex-wrap:wrap;gap:6px;padding:16px 22px 10px;flex:none}',
    '.avs-tab{flex:none;border:1px solid #D3D9E6;background:#FFFFFF;color:#33405F;border-radius:999px;padding:7px 14px;min-height:38px;font:inherit;font-size:14px;font-weight:600;cursor:pointer}',
    '.avs-tab[aria-selected="true"]{background:#0D1838;border-color:#0D1838;color:#FFFFFF}',
    '.avs-tab.star{border-color:#E8B931}.avs-tab.star[aria-selected="true"]{background:#E8B931;border-color:#E8B931;color:#0D1838}',
    '.avs-panel{padding:6px 22px 22px;overflow-y:auto;min-height:0;flex:1}',
    '.avs-sub{margin:14px 0 8px;font-family:Caveat,"Segoe Print",cursive;font-size:22px;color:#1A2A5C;line-height:1;font-weight:600}',
    '.avs-note{margin:6px 0 4px;font-size:14px;color:#4B5675}',
    '.avs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:10px}',
    '.avs-opt{position:relative;border:1.6px solid #DDE2EC;background:#FFFFFF;border-radius:12px;padding:6px 4px 6px;cursor:pointer;font:inherit;color:#33405F;display:flex;flex-direction:column;align-items:center;gap:2px;transition:border-color .15s,transform .15s}',
    '.avs-opt:hover{border-color:#9DB8FF;transform:translateY(-1px)}',
    '.avs-opt[aria-pressed="true"]{border-color:#2F6BFF;box-shadow:0 0 0 3px rgba(47,107,255,0.18)}',
    '.avs-opt img{width:64px;height:64px;display:block;border-radius:10px;background:#F3F5FA}',
    '.avs-opt span{font-size:11.5px;line-height:1.2;text-align:center}',
    '.avs-opt.locked{cursor:not-allowed;background:#F6F7FB}.avs-opt.locked:hover{transform:none;border-color:#DDE2EC}',
    '.avs-opt.locked img{filter:grayscale(1);opacity:.45}',
    '.avs-opt .lk{position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;background:#0D1838;display:flex;align-items:center;justify-content:center}',
    '.avs-opt .lk svg{width:12px;height:12px;fill:none;stroke:#FFFFFF;stroke-width:2.2;stroke-linecap:round}',
    '.avs-opt small{font-size:10.5px;color:#8A6A10;line-height:1.2;text-align:center}',
    '.avs-sw{display:flex;flex-wrap:wrap;gap:8px}',
    '.avs-swb{width:36px;height:36px;border-radius:50%;border:2px solid #FFFFFF;box-shadow:0 0 0 1.5px #C9D1E1;cursor:pointer;padding:0}',
    '.avs-swb[aria-pressed="true"]{box-shadow:0 0 0 2.5px #2F6BFF}',
    '.avs-swb.t{background-image:linear-gradient(45deg,#DDE2EC 25%,transparent 25%,transparent 75%,#DDE2EC 75%),linear-gradient(45deg,#DDE2EC 25%,#FFFFFF 25%,#FFFFFF 75%,#DDE2EC 75%);background-size:10px 10px;background-position:0 0,5px 5px}',
    '.avs-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 22px;border-top:1px solid #E6E2D6;background:#FFFEFB;flex:none}',
    '.avs-rm{border:0;background:none;color:#B4351F;font:inherit;font-size:14px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;padding:10px 4px;min-height:44px}',
    '.avs-acts{display:flex;gap:8px}',
    '.avs-no{border:1.6px solid #C9D1E1;background:#FFFFFF;color:#33405F;border-radius:999px;padding:10px 18px;min-height:44px;font:inherit;font-weight:600;cursor:pointer}',
    '.avs-ok{border:0;background:#2F6BFF;color:#FFFFFF;border-radius:999px;padding:10px 22px;min-height:44px;font:inherit;font-weight:700;cursor:pointer;box-shadow:0 12px 22px -12px rgba(47,107,255,0.8)}',
    '.avs-ok:hover{background:#1F5FD6}.avs-ok:disabled{opacity:.6;cursor:default}',
    '.avs button:focus-visible{outline:2px solid #2F6BFF;outline-offset:2px}',
    '@media (max-width:760px){.avs-back{padding:0;align-items:stretch}.avs{height:100%;border-radius:0}.avs-head{padding:14px 16px 10px}.avs-head h2{font-size:23px}.avs-body{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr)}.avs-side{border-right:0;border-bottom:1px solid #E6E2D6;padding:12px 16px;display:grid;grid-template-columns:112px minmax(0,1fr);gap:8px 12px;align-items:center;overflow:visible}.avs-prev{width:112px;height:112px;grid-row:span 4}.avs-prev .avs-live,.avs-prev img{border-radius:20px}.avs-row{justify-content:flex-start}.avs-chip{padding:5px 11px;min-height:34px;font-size:13px}.avs-dl{min-height:34px;padding:5px 11px;font-size:13px;flex:none}.avs-lbl,.avs-ex{display:none}.avs-tabs{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin;padding:10px 16px 6px}.avs-panel{padding:4px 16px 16px}.avs-grid{grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px}.avs-opt img{width:54px;height:54px}.avs-foot{padding:10px 16px}}',
    /* renk çarkı, son renkler */
    '.avs-pick{position:relative;display:inline-flex;align-items:center;justify-content:center;background:conic-gradient(#ff5c5c,#ffd966,#7fe3b5,#65c9ff,#2f6bff,#c0aede,#ff488e,#ff5c5c);overflow:hidden;cursor:pointer}',
    '.avs-pick span{width:22px;height:22px;border-radius:50%;background:#FFFFFF;color:#0D1838;font-weight:700;font-size:16px;line-height:22px;text-align:center;pointer-events:none}',
    '.avs-pick input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;border:0;padding:0}',
    '.avs-pick:focus-within{box-shadow:0 0 0 2.5px #2F6BFF}',
    '.avs-rec{margin-top:8px;align-items:center}',
    '.avs-rec-l{font-family:Caveat,"Segoe Print",cursive;font-size:18px;color:#5B6787;margin-right:4px}',
    '.avs-rec .avs-swb{width:30px;height:30px}',
    /* kombinler, dolap, bölüm */
    '.avs-big{grid-template-columns:repeat(auto-fill,minmax(112px,1fr))}',
    '.avs-big .avs-opt img{width:84px;height:84px}',
    '.avs-opt b{font-weight:700;color:#0D1838}',
    '.avs-why{font-size:10.5px;color:#6A7593;line-height:1.25;text-align:center}',
    '.avs-closet{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;max-width:420px}',
    '.avs-slot{position:relative}',
    '.avs-slot .avs-opt{width:100%;min-height:118px;justify-content:center}',
    '.avs-empty{border-style:dashed;background:#FBFAF6;color:#4B5675}',
    '.avs-empty b{width:44px;height:44px;border-radius:50%;border:1.6px dashed #9DA8C3;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:600;color:#2F6BFF;margin:6px 0 4px}',
    '.avs-slot-x{position:absolute;top:-8px;right:-8px;width:28px;height:28px;border-radius:50%;border:1.6px solid #C9D1E1;background:#FFFFFF;color:#B4351F;font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}',
    '.avs-slot-x:hover{border-color:#B4351F}',
    '.avs-opt.mine{border-color:#E8B931;background:#FFFBEA}',
    '.avs-mine{position:absolute;top:-9px;left:50%;transform:translateX(-50%) rotate(-3deg);background:#E8B931;color:#0D1838;font-style:normal;font-family:Caveat,"Segoe Print",cursive;font-size:15px;line-height:1;padding:2px 8px 3px;border-radius:999px;white-space:nowrap}',
    '@media (max-width:760px){.avs-big{grid-template-columns:repeat(auto-fill,minmax(96px,1fr))}.avs-big .avs-opt img{width:66px;height:66px}.avs-slot .avs-opt{min-height:100px}}',
    /* sticker'lar */
    '.avs-st{pointer-events:none;filter:drop-shadow(1.5px 0 0 #fff) drop-shadow(-1.5px 0 0 #fff) drop-shadow(0 1.5px 0 #fff) drop-shadow(0 -1.5px 0 #fff) drop-shadow(0 5px 6px rgba(13,24,56,0.3))}',
    '.avs-ex img{filter:drop-shadow(1.5px 0 0 #fff) drop-shadow(-1.5px 0 0 #fff) drop-shadow(0 1.5px 0 #fff) drop-shadow(0 -1.5px 0 #fff) drop-shadow(0 4px 5px rgba(13,24,56,0.25))}',
    '.axa-hint .avs-st{position:absolute;left:-34px;top:-30px;width:54px;height:54px;transform:rotate(-8deg)}',
    '.achievement-toast .avs-st{position:absolute;right:-14px;top:-26px;width:62px;height:62px;transform:rotate(8deg)}',
    /* canlı kart (2.5D): eğilme, ışık, göz kırpma, ruh hali */
    '.avs-live{position:relative;display:inline-block;line-height:0;vertical-align:middle;border-radius:inherit;transform:perspective(520px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));transition:transform .5s cubic-bezier(.2,.7,.2,1);will-change:transform}',
    '.avs-live.tilt.moving{transition:transform .12s linear}',
    '.avs-live > .avs-ov{position:absolute;inset:0;width:100%;height:100%;border-radius:inherit;opacity:0;pointer-events:none;object-fit:cover}',
    '.avs-live > .avs-ov.on{opacity:1}',
    '.avs-live.blink > .avs-blink{opacity:1}',
    '.avs-live > .avs-sheen{position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,0.38) 46%,transparent 60%);background-size:260% 100%;background-position:calc(50% + var(--sx,0) * 40%) 0;mix-blend-mode:soft-light;opacity:.9}',
    '.avs-live.tilt{box-shadow:calc(var(--sx,0) * -10px) calc(12px + var(--sy,0) * -6px) 22px -14px rgba(13,24,56,0.55)}',
    '@media (prefers-reduced-motion:no-preference){.avs-live.idle{animation:avsSway 7s ease-in-out infinite}@keyframes avsSway{0%,100%{transform:perspective(520px) rotateX(2deg) rotateY(-5deg)}50%{transform:perspective(520px) rotateX(-2deg) rotateY(5deg)}}}',
    '.avs-miss{position:fixed;z-index:100001;padding:6px 12px 7px;border-radius:14px 14px 14px 4px;background:#FFFFFF;border:1.6px solid #1A2A5C;color:#1A2A5C;font-family:Caveat,"Segoe Print",cursive;font-size:20px;line-height:1;box-shadow:0 12px 22px -14px rgba(13,24,56,0.6);pointer-events:none}',
    '#axa-layer .axa-m.user.avs-me{position:relative;margin-right:36px;overflow:visible}',
    '.avs-me-av{position:absolute;right:-36px;bottom:-2px;width:28px;height:28px;border-radius:50%;object-fit:cover;background:#DCE6FF;box-shadow:0 0 0 2px #FFFFFF,0 4px 8px -4px rgba(13,24,56,0.5)}',
    '.sn-score{position:relative}.sn-score > .avs-st,#result-score-circle > .avs-st{position:absolute;right:-58px;top:-26px;width:66px;height:66px;transform:rotate(8deg);z-index:2}',
    '@media (max-width:760px){.sn-score > .avs-st,#result-score-circle > .avs-st{right:-18px;top:-34px;width:52px;height:52px}}',
    '@media (prefers-reduced-motion:no-preference){.avs-st,.avs-miss{animation:avsPop .45s cubic-bezier(.3,1.5,.5,1) both}@keyframes avsPop{from{opacity:0;scale:.6}to{opacity:1;scale:1}}}'
  ].join('\n');
  var injectCss = function () {
    if (document.getElementById('avs-css')) return;
    var st = document.createElement('style'); st.id = 'avs-css'; st.textContent = css; document.head.appendChild(st);
  };

  /* ---------- rozetler ---------- */
  var unlocked = null; /* { achievement_id: true } */
  var loadUnlocks = function () {
    var sb = g('supabaseClient'), user = g('currentUser');
    if (!sb || !user || !user.id) return Promise.resolve({});
    return Promise.resolve(sb.from('user_achievements').select('achievement_id').eq('user_id', user.id)).then(function (r) {
      var m = {}; ((r && r.data) || []).forEach(function (x) { m[x.achievement_id] = true; }); return m;
    }).catch(function () { return {}; });
  };
  var badgeTitle = function (id) { var L = g('ACHIEVEMENTS_LOOKUP'); return (L && L[id] && L[id].title) || id; };

  /* ---------- editör ---------- */
  var TABS = [
    { id: 'kombin', label: 'Kombinler' }, { id: 'ten', label: 'Ten' }, { id: 'sac', label: 'Saç' }, { id: 'goz', label: 'Gözler' }, { id: 'kas', label: 'Kaşlar' },
    { id: 'agiz', label: 'Ağız' }, { id: 'sakal', label: 'Sakal' }, { id: 'gozluk', label: 'Gözlük' }, { id: 'kiyafet', label: 'Kıyafet' }, { id: 'arka', label: 'Arka plan' },
    { id: 'bolum', label: 'Bölüm' }, { id: 'rozet', label: '★ Rozet parçaları', star: true }
  ];
  var cfg = null, tab = 'sac', back = null, lastFocus = null, busy = false, hist = [];
  var LOCK = '<span class="lk" aria-hidden="true"><svg viewBox="0 0 12 12"><rect x="2.5" y="5.5" width="7" height="5" rx="1"/><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5"/></svg></span>';

  var build = function () {
    injectCss();
    back = document.createElement('div');
    back.className = 'avs-back'; back.hidden = true;
    back.innerHTML =
      '<div class="avs" role="dialog" aria-modal="true" aria-labelledby="avs-title">' +
        '<div class="avs-head"><div><span class="avs-eyb">avatar stüdyosu</span><h2 id="avs-title">Avatarını oluştur</h2></div>' +
        '<button type="button" class="avs-x" data-avs-close aria-label="Kapat">×</button></div>' +
        '<div class="avs-body">' +
          '<div class="avs-side">' +
            '<div class="avs-prev"><span class="avs-live tilt" data-avs-live><img alt="Avatar önizlemesi" data-avs-prev><img class="avs-ov avs-blink" alt="" aria-hidden="true" data-avs-blink><i class="avs-sheen" aria-hidden="true"></i></span></div>' +
            '<div class="avs-row" role="group" aria-label="Hızlı başlangıç"><button type="button" class="avs-chip" data-avs-preset="kiz">Kız ile başla</button><button type="button" class="avs-chip" data-avs-preset="erkek">Erkek ile başla</button></div>' +
            '<div class="avs-row"><button type="button" class="avs-chip ghost" data-avs-dice>Zar at</button><button type="button" class="avs-chip ghost" data-avs-undo disabled>Geri al</button></div>' +
            '<span class="avs-lbl">ifadelerin</span>' +
            '<div class="avs-ex" data-avs-ex aria-label="İfade seti"></div>' +
            '<div class="avs-row"><button type="button" class="avs-dl" data-avs-dl>PNG indir</button><button type="button" class="avs-dl" data-avs-card>Öğrenci kartı</button></div>' +
          '</div>' +
          '<div class="avs-main">' +
            '<div class="avs-tabs" role="tablist" aria-label="Avatar parçaları">' + TABS.map(function (t) { return '<button type="button" class="avs-tab' + (t.star ? ' star' : '') + '" role="tab" id="avs-t-' + t.id + '" aria-controls="avs-panel" data-avs-tab="' + t.id + '">' + t.label + '</button>'; }).join('') + '</div>' +
            '<div class="avs-panel" id="avs-panel" role="tabpanel" data-avs-panel></div>' +
          '</div>' +
        '</div>' +
        '<div class="avs-foot"><button type="button" class="avs-rm" data-avs-rm>Avatarı kaldır</button>' +
          '<div class="avs-acts"><button type="button" class="avs-no" data-avs-close>Vazgeç</button><button type="button" class="avs-ok" data-avs-save>Kaydet</button></div></div>' +
      '</div>';
    document.body.appendChild(back);

    back.addEventListener('click', function (e) {
      var t = e.target;
      if (t === back || t.closest('[data-avs-close]')) { close(); return; }
      var tb = t.closest('[data-avs-tab]'); if (tb) { tab = tb.getAttribute('data-avs-tab'); renderTabs(); renderPanel(); return; }
      var pr = t.closest('[data-avs-preset]'); if (pr) { change(assign({}, cfg, PRESETS[pr.getAttribute('data-avs-preset')], { skinColor: cfg.skinColor })); return; }
      if (t.closest('[data-avs-dice]')) { change(randomCfg()); return; }
      if (t.closest('[data-avs-undo]')) { undo(); return; }
      var of = t.closest('[data-outfit]'); if (of) { var o = OUTFITS.filter(function (x) { return x.k === of.getAttribute('data-outfit'); })[0]; if (o) change(outfitCfg(o), '[data-outfit="' + o.k + '"]'); return; }
      var dp = t.closest('[data-dept]'); if (dp) { var dk = dp.getAttribute('data-dept'), nd = assign({}, cfg); nd.xDept = cfg.xDept === dk ? '' : dk; change(nd, dk ? '[data-dept="' + dk + '"]' : null); return; }
      var wr = t.closest('[data-wear]'); if (wr) { var sc = closet.slots[+wr.getAttribute('data-wear')]; if (sc) change(clean(sc), '[data-wear="' + wr.getAttribute('data-wear') + '"]'); return; }
      var kp = t.closest('[data-keep]'); if (kp) { var ki = +kp.getAttribute('data-keep'); closetSave(ki); renderPanel(); var w2 = back.querySelector('[data-wear="' + ki + '"]'); if (w2) w2.focus(); alertMsg('success', (ki + 1) + '. stil dolabına kondu.'); return; }
      var dr = t.closest('[data-drop]'); if (dr) { var di = +dr.getAttribute('data-drop'); closetDrop(di); renderPanel(); var k2 = back.querySelector('[data-keep="' + di + '"]'); if (k2) k2.focus(); return; }
      if (t.closest('.avs-pick')) return; /* renk çarkı kendi açılır */
      var xo = t.closest('[data-x]'); if (xo) {
        if (xo.classList.contains('locked')) return;
        var it = EXTRAS.filter(function (x) { return x.k === xo.getAttribute('data-x'); })[0];
        var nc = assign({}, cfg); nc[it.slot] = cfg[it.slot] === it.k ? '' : it.k;
        change(nc, '[data-x="' + it.k + '"]'); return;
      }
      var op = t.closest('[data-k]'); if (op) {
        var k = op.getAttribute('data-k'), v = op.getAttribute('data-v'), c2 = assign({}, cfg); c2[k] = v;
        if (op.classList.contains('avs-swb')) pushRecent(k, v);
        change(c2, '[data-k="' + k + '"][data-v="' + (window.CSS && CSS.escape ? CSS.escape(v) : v) + '"]'); return;
      }
      if (t.closest('[data-avs-dl]')) { download(); return; }
      if (t.closest('[data-avs-card]')) { idCard(t.closest('[data-avs-card]')); return; }
      if (t.closest('[data-avs-save]')) { save(); return; }
      if (t.closest('[data-avs-rm]')) { removeIt(); return; }
    });
    back.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(); return; }
      if (e.key === 'Tab') { /* odak pencerede kalsın */
        var f = Array.prototype.slice.call(back.querySelectorAll('button:not([disabled])')).filter(function (b) { return b.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
      var tb = e.target.closest && e.target.closest('[data-avs-tab]');
      if (tb && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        var i = TABS.findIndex(function (x) { return x.id === tab; }), n = TABS.length;
        tab = TABS[(i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n].id; renderTabs(); renderPanel();
        back.querySelector('[data-avs-tab="' + tab + '"]').focus();
      }
    });
    /* renk çarkı: sürüklerken önizleme canlı değişir, bırakınca kaydedilir (geri alınabilir) */
    var pickRaf = 0, pickBase = null;
    back.addEventListener('input', function (e) {
      var inp = e.target.closest && e.target.closest('[data-pick]'); if (!inp) return;
      var k = inp.getAttribute('data-pick'), hex = String(inp.value || '').replace('#', '').toLowerCase(); if (!HEX.test(hex)) return;
      if (!pickBase) pickBase = assign({}, cfg);
      cfg = assign({}, cfg); cfg[k] = hex;
      if (!pickRaf) pickRaf = requestAnimationFrame(function () { pickRaf = 0; renderSide(); });
    });
    back.addEventListener('change', function (e) {
      var inp = e.target.closest && e.target.closest('[data-pick]'); if (!inp) return;
      var k = inp.getAttribute('data-pick'), hex = String(inp.value || '').replace('#', '').toLowerCase(); if (!HEX.test(hex)) return;
      var next = assign({}, cfg); next[k] = hex;
      if (pickBase) { cfg = pickBase; pickBase = null; }
      pushRecent(k, hex); change(next, '[data-pick="' + k + '"]');
    });
    /* önizleme imlece göre eğilir */
    var pv = back.querySelector('[data-avs-live]');
    back.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') tiltTo(pv, e.clientX, e.clientY, 260, 14); });
    back.addEventListener('pointerleave', function () { tiltReset(pv); });
  };

  /* geri al: her değişiklikten önce eski hali sakla */
  var change = function (next, focusSel) {
    hist.push(assign({}, cfg)); if (hist.length > 40) hist.shift();
    cfg = clean(next); refresh(focusSel);
  };
  var undo = function () { if (!hist.length) return; cfg = hist.pop(); refresh(); };
  var randomCfg = function () {
    var tops = [].concat(TOPS[0][1], TOPS[1][1]).map(function (x) { return x[0]; }).filter(Boolean), covers = TOPS[2][1].map(function (x) { return x[0]; });
    return assign({}, cfg, {
      skinColor: pick(SKIN)[0], top: Math.random() < 0.12 ? pick(covers) : pick(tops),
      hairColor: pick(HAIR_C.slice(0, 8))[0], hatColor: pick(HAT_C)[0],
      eyes: pick(['default', 'happy', 'wink', 'squint', 'side', 'surprised']), eyebrows: pick(BROWS.slice(0, 6))[0], mouth: pick(['smile', 'default', 'twinkle', 'tongue', 'serious']),
      facialHair: Math.random() < 0.2 ? pick(BEARD.slice(1))[0] : '', facialHairColor: pick(HAIR_C.slice(0, 6))[0],
      accessories: Math.random() < 0.25 ? pick(GLASS.slice(1, 5))[0] : '',
      clothing: pick(CLOTH)[0], clothesColor: pick(CLOTH_C)[0], bg: pick(BG.slice(0, 8))[0]
    });
  };

  var renderTabs = function () {
    Array.prototype.forEach.call(back.querySelectorAll('[data-avs-tab]'), function (b) {
      var on = b.getAttribute('data-avs-tab') === tab;
      b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
    });
    back.querySelector('[data-avs-panel]').setAttribute('aria-labelledby', 'avs-t-' + tab);
  };
  var optGrid = function (key, list, title) {
    return (title ? '<h3 class="avs-sub">' + esc(title) + '</h3>' : '') + '<div class="avs-grid">' + list.map(function (o) {
      var c = assign({}, cfg); c[key] = o[0];
      return '<button type="button" class="avs-opt" data-k="' + key + '" data-v="' + esc(o[0]) + '" aria-pressed="' + (cfg[key] === o[0]) + '" aria-label="' + esc(o[1]) + '">' +
        '<img alt="" loading="lazy" src="' + esc(srcOf(c)) + '"><span>' + esc(o[1]) + '</span></button>';
    }).join('') + '</div>';
  };
  /* renkler: hazır palet + son kullandıkların + serbest seçici (renk çarkı) */
  var HEX = /^[0-9a-f]{6}$/i;
  var recentKey = function (key) { return key === 'skinColor' ? 'ten' : key === 'bg' ? 'zemin' : 'renk'; };
  var recents = function (key) { var r = ls.get('acx-avatar-recent') || {}; return (r[recentKey(key)] || []).filter(function (h) { return HEX.test(h); }); };
  var pushRecent = function (key, hex) {
    if (!HEX.test(hex)) return;
    var r = ls.get('acx-avatar-recent') || {}, k = recentKey(key), l = (r[k] || []).filter(function (h) { return h !== hex; });
    l.unshift(hex); r[k] = l.slice(0, 6); ls.set('acx-avatar-recent', r);
  };
  var swb = function (key, hex, name, extra) {
    var t = hex === 'transparent';
    return '<button type="button" class="avs-swb' + (t ? ' t' : '') + (extra || '') + '" data-k="' + key + '" data-v="' + hex + '" aria-pressed="' + (cfg[key] === hex) + '" aria-label="' + esc(name) + '" title="' + esc(name) + '"' + (t ? '' : ' style="background:#' + hex + '"') + '></button>';
  };
  var swatches = function (key, list, title) {
    var inList = function (h) { return list.some(function (o) { return o[0] === h; }); };
    var rec = recents(key).filter(function (h) { return !inList(h); });
    var cur = cfg[key];
    if (HEX.test(cur) && !inList(cur) && rec.indexOf(cur) < 0) rec.unshift(cur);
    var val = HEX.test(cur) ? '#' + cur : '#ffffff';
    return '<h3 class="avs-sub">' + esc(title) + '</h3><div class="avs-sw">' + list.map(function (o) { return swb(key, o[0], o[1]); }).join('') +
      '<label class="avs-swb avs-pick" title="Kendi rengini seç"><input type="color" data-pick="' + key + '" value="' + val + '" aria-label="' + esc(title) + ': kendi rengini seç"><span aria-hidden="true">+</span></label></div>' +
      (rec.length ? '<div class="avs-sw avs-rec"><span class="avs-rec-l">son kullandıkların</span>' + rec.slice(0, 6).map(function (h) { return swb(key, h, 'özel renk #' + h); }).join('') + '</div>' : '');
  };
  /* dolabım: 3 kayıtlı görünüş; bu cihazda saklanır, hesabına da yedeklenir */
  var CLOSET_N = 3, closet = null;
  var uidOf = function () { var u = g('currentUser'); return (u && u.id) || 'anon'; };
  var closetKey = function () { return 'acx-avatar-closet:' + uidOf(); };
  var closetLocal = function () { var c = ls.get(closetKey()); return c && Array.isArray(c.slots) ? c : { at: 0, slots: [] }; };
  var closetPath = function () { return uidOf() + '/avatar-dolap.json'; };
  var closetPush = function () {
    var sb = g('supabaseClient'); if (!sb || uidOf() === 'anon') return;
    try {
      var blob = new Blob([JSON.stringify(closet)], { type: 'application/json' });
      Promise.resolve(sb.storage.from('avatars').upload(closetPath(), blob, { upsert: true, cacheControl: '0', contentType: 'application/json' })).catch(function () { /* yalnızca bu cihazda kalır */ });
    } catch (e) { /* yok */ }
  };
  var closetPull = function () {
    var sb = g('supabaseClient'); if (!sb || uidOf() === 'anon') return Promise.resolve();
    try {
      var pub = sb.storage.from('avatars').getPublicUrl(closetPath()), url = pub && pub.data && pub.data.publicUrl;
      if (!url) return Promise.resolve();
      /* önce dosya var mı bak (yoksa konsolda 404 kalabalığı olmasın) */
      return Promise.resolve(sb.storage.from('avatars').list(uidOf(), { search: 'avatar-dolap.json', limit: 1 })).then(function (r) {
        if (!r || r.error || !r.data || !r.data.some(function (f) { return f && f.name === 'avatar-dolap.json'; })) return null;
        return fetch(url + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r2) { return r2.ok ? r2.json() : null; });
      }).then(function (rem) {
        if (rem && Array.isArray(rem.slots) && (rem.at || 0) > (closet.at || 0)) { closet = rem; ls.set(closetKey(), closet); return true; }
      }).catch(function () { });
    } catch (e) { return Promise.resolve(); }
  };
  var closetSave = function (i) { closet.slots[i] = assign({}, cfg); closet.at = Date.now(); ls.set(closetKey(), closet); closetPush(); };
  var closetDrop = function (i) { closet.slots[i] = null; closet.at = Date.now(); ls.set(closetKey(), closet); closetPush(); };
  var closetHtml = function () {
    var h = '<h3 class="avs-sub">dolabım</h3><p class="avs-note">Beğendiğin görünüşleri sakla, tek dokunuşla geri dön. Hesabına da yedeklenir.</p><div class="avs-closet">';
    for (var i = 0; i < CLOSET_N; i++) {
      var c = closet.slots[i];
      if (c) h += '<div class="avs-slot"><button type="button" class="avs-opt" data-wear="' + i + '" aria-label="' + (i + 1) + '. stili giy"><img alt="" src="' + esc(srcOf(clean(c))) + '"><span>' + (i + 1) + '. stil · giy</span></button>' +
        '<button type="button" class="avs-slot-x" data-drop="' + i + '" aria-label="' + (i + 1) + '. stili sil" title="Sil">×</button></div>';
      else h += '<div class="avs-slot"><button type="button" class="avs-opt avs-empty" data-keep="' + i + '"><b aria-hidden="true">+</b><span>şu anki görünüşü sakla</span></button></div>';
    }
    return h + '</div>';
  };
  var outfitCfg = function (o) { return assign({}, cfg, o.set); };
  var outfitOn = function (o) { var c = outfitCfg(o); return Object.keys(o.set).every(function (k) { return cfg[k] === c[k]; }); };
  var outfitsHtml = function () {
    return '<h3 class="avs-sub">hazır kombinler</h3><p class="avs-note">Yüzün, tenin ve saçın aynı kalır; kıyafet, aksesuar ve zemin değişir.</p><div class="avs-grid avs-big">' + OUTFITS.map(function (o) {
      return '<button type="button" class="avs-opt" data-outfit="' + o.k + '" aria-pressed="' + outfitOn(o) + '" aria-label="' + esc(o.label + ': ' + o.note) + '"><img alt="" loading="lazy" src="' + esc(srcOf(outfitCfg(o))) + '"><span><b>' + esc(o.label) + '</b></span><small class="avs-why">' + esc(o.note) + '</small></button>';
    }).join('') + '</div>';
  };
  var deptHtml = function () {
    var p = profile(), mine = deptOf(p && p.department);
    var list = DEPTX.slice().sort(function (a, b) { return (b.k === mine) - (a.k === mine); });
    return '<p class="avs-note">Bölümünü anlatan bir parça tak. ' + (mine ? 'Senin bölümüne uygun olan başta.' : 'Hepsi herkese açık.') + '</p><div class="avs-grid">' + list.map(function (x) {
      var c = assign({}, cfg, { xDept: x.k }), on = cfg.xDept === x.k;
      return '<button type="button" class="avs-opt' + (x.k === mine ? ' mine' : '') + '" data-dept="' + x.k + '" aria-pressed="' + on + '" aria-label="' + esc(x.label + ' (' + x.fac + ')' + (x.k === mine ? ', senin bölümün' : '')) + '">' +
        (x.k === mine ? '<em class="avs-mine">senin bölümün</em>' : '') + '<img alt="" loading="lazy" src="' + esc(srcOf(c)) + '"><span>' + esc(x.label) + '</span><small class="avs-why">' + esc(x.fac) + '</small></button>';
    }).join('') + '</div>' + (cfg.xDept ? '<div class="avs-row" style="justify-content:flex-start;margin-top:12px"><button type="button" class="avs-chip ghost" data-dept="">Bölüm parçasını çıkar</button></div>' : '');
  };
  var extrasGrid = function () {
    if (!unlocked) return '<p class="avs-note">Rozetlerin yükleniyor…</p>';
    var n = EXTRAS.filter(function (x) { return unlocked[x.need]; }).length;
    return '<p class="avs-note">Rozet kazandıkça Acadex\'e özel parçalar açılır. <b>' + n + ' / ' + EXTRAS.length + '</b> açık.</p><div class="avs-grid">' + EXTRAS.map(function (x) {
      var open = !!unlocked[x.need], c = assign({}, cfg); c[x.slot] = x.k;
      var on = cfg[x.slot] === x.k;
      return '<button type="button" class="avs-opt' + (open ? '' : ' locked') + '" data-x="' + x.k + '" aria-pressed="' + on + '"' + (open ? '' : ' aria-disabled="true"') +
        ' aria-label="' + esc(x.label + (open ? '' : ', kilitli: ' + badgeTitle(x.need) + ' rozetiyle açılır')) + '">' + (open ? '' : LOCK) +
        '<img alt="" loading="lazy" src="' + esc(srcOf(c)) + '"><span>' + esc(x.label) + '</span>' + (open ? '' : '<small>' + esc(badgeTitle(x.need)) + ' rozetiyle</small>') + '</button>';
    }).join('') + '</div>';
  };
  var renderPanel = function () {
    var p = back.querySelector('[data-avs-panel]'), h = '';
    if (tab === 'ten') h = swatches('skinColor', SKIN, 'ten rengi');
    else if (tab === 'sac') {
      h = TOPS.map(function (gr) { return optGrid('top', gr[1], gr[0].toLocaleLowerCase('tr')); }).join('');
      h = (COVERS[cfg.top] ? swatches('hatColor', HAT_C, 'örtü / şapka rengi') : swatches('hairColor', HAIR_C, 'saç rengi')) + h;
    }
    else if (tab === 'goz') h = optGrid('eyes', EYES, '');
    else if (tab === 'kas') h = optGrid('eyebrows', BROWS, '');
    else if (tab === 'agiz') h = optGrid('mouth', MOUTH, '');
    else if (tab === 'sakal') h = optGrid('facialHair', BEARD, '') + (cfg.facialHair ? swatches('facialHairColor', HAIR_C, 'sakal rengi') : '');
    else if (tab === 'gozluk') h = optGrid('accessories', GLASS, '') + (cfg.accessories ? swatches('accessoriesColor', HAT_C, 'çerçeve rengi') : '');
    else if (tab === 'kiyafet') h = optGrid('clothing', CLOTH, '') + swatches('clothesColor', CLOTH_C, 'kıyafet rengi');
    else if (tab === 'arka') h = swatches('bg', BG, 'arka plan') + (cfg.xBg ? '<p class="avs-note">Şu an rozet arka planı (yıldızlı gece) seçili; renk için onu "Rozet parçaları"ndan kaldır.</p>' : '');
    else if (tab === 'rozet') h = extrasGrid();
    else if (tab === 'kombin') h = closetHtml() + outfitsHtml();
    else if (tab === 'bolum') h = deptHtml();
    p.innerHTML = h;
  };
  var renderSide = function () {
    var prev = back.querySelector('[data-avs-prev]'), bl = back.querySelector('[data-avs-blink]'), my = cfg;
    srcAsync(cfg).then(function (s) { if (cfg === my) prev.src = s; });
    srcAsync(withExpr(cfg, BLINK)).then(function (s) { if (cfg === my) bl.src = s; });
    back.querySelector('[data-avs-ex]').innerHTML = EXPR.map(function (ex) {
      return '<figure><img alt="' + esc(ex.label) + ' ifadesi" src="' + esc(srcOf(withExpr(cfg, ex), true)) + '"><figcaption>' + esc(ex.label) + '</figcaption></figure>';
    }).join('');
    back.querySelector('[data-avs-undo]').disabled = !hist.length;
  };
  var refresh = function (focusSel) {
    renderSide(); renderPanel();
    if (focusSel) { var el = back.querySelector(focusSel); if (el) el.focus(); }
  };

  var open = function () {
    if (!back) build();
    lastFocus = document.activeElement;
    var p = profile();
    cfg = clean(cfgFromUrl(p && p.avatar_url) || ls.get('acx-avatar-cfg') || DEF);
    hist = []; tab = 'sac';
    closet = closetLocal(); closetPull().then(function (ch) { if (ch && !back.hidden && tab === 'kombin') renderPanel(); });
    back.hidden = false; document.documentElement.style.overflow = 'hidden';
    renderTabs(); refresh();
    back.querySelector('[data-avs-tab="sac"]').focus();
    loadLib().then(function (ok) { if (ok && !back.hidden) refresh(); });
    loadUnlocks().then(function (m) { unlocked = m; if (!back.hidden && tab === 'rozet') renderPanel(); });
  };
  var close = function () {
    if (!back || back.hidden) return;
    back.hidden = true; document.documentElement.style.overflow = '';
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* yok */ } }
  };

  var saveBlob = function (blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  };
  var download = function () {
    loadLib().then(function () { return pngOf(cfg, 512); }).then(function (blob) { saveBlob(blob, 'acadex-avatar.png'); })
      .catch(function (e) { console.error('avatar png', e); alertMsg('error', 'PNG hazırlanamadı. Biraz sonra tekrar dener misin?'); });
  };

  /* ---------- öğrenci kartı ---------- */
  var roundRect = function (x, cx, cy, w, h, r) { x.beginPath(); x.moveTo(cx + r, cy); x.arcTo(cx + w, cy, cx + w, cy + h, r); x.arcTo(cx + w, cy + h, cx, cy + h, r); x.arcTo(cx, cy + h, cx, cy, r); x.arcTo(cx, cy, cx + w, cy, r); x.closePath(); };
  var fitText = function (x, text, maxW, size, font) { var s = size; do { x.font = font.replace('{s}', s); s -= 2; } while (x.measureText(text).width > maxW && s > 18); };
  var cardBlob = function () {
    var p = profile() || {}, name = String(p.full_name || 'Acadex öğrencisi').trim();
    var cap = function (w) { return w ? w.charAt(0).toLocaleUpperCase('tr') + w.slice(1) : ''; };
    name = name.split(/\s+/).map(cap).join(' ');
    var dept = String(p.department || 'Her bölüm');
    var fonts = document.fonts && document.fonts.load ? Promise.all(['600 64px Caveat', '800 40px "Bricolage Grotesque"', '500 20px "JetBrains Mono"', '500 24px "Instrument Sans"'].map(function (f) { return document.fonts.load(f).catch(function () {}); })) : Promise.resolve();
    return Promise.all([pngOf(cfg, 512).then(function (b) { return loadImg(URL.createObjectURL(b)); }), loadImg('assets/landing/acadex-logo.webp').catch(function () { return null; }), fonts]).then(function (r) {
      var av = r[0], logo = r[1], W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var x = cv.getContext('2d');
      /* zemin: gece mavisi, lamba ışığı */
      x.fillStyle = '#0D1838'; x.fillRect(0, 0, W, H);
      var gl = x.createRadialGradient(W * 0.5, H * 0.42, 40, W * 0.5, H * 0.42, 720); gl.addColorStop(0, 'rgba(91,140,255,0.28)'); gl.addColorStop(1, 'rgba(91,140,255,0)');
      x.fillStyle = gl; x.fillRect(0, 0, W, H);
      /* ip */
      var cg = x.createLinearGradient(0, 0, 0, 360); cg.addColorStop(0, '#1F4FD6'); cg.addColorStop(1, '#2F6BFF');
      x.fillStyle = cg; x.fillRect(W / 2 - 14, 0, 28, 372);
      x.fillStyle = '#B9C2D6'; roundRect(x, W / 2 - 38, 356, 76, 34, 8); x.fill();
      /* kart */
      var cx = 120, cy = 400, cw = 840, ch = 560;
      x.save(); x.shadowColor = 'rgba(0,0,0,0.45)'; x.shadowBlur = 60; x.shadowOffsetY = 30; x.fillStyle = '#F6F7FB'; roundRect(x, cx, cy, cw, ch, 36); x.fill(); x.restore();
      x.fillStyle = '#FFFFFF'; roundRect(x, cx, cy, cw, ch, 36); x.fill();
      x.fillStyle = '#C9D1E1'; roundRect(x, W / 2 - 50, cy + 26, 100, 14, 7); x.fill();
      /* üst satır */
      if (logo) x.drawImage(logo, cx + 48, cy + 62, 56, 56);
      x.fillStyle = '#1A2A5C'; x.font = '500 22px "JetBrains Mono", monospace'; x.textBaseline = 'middle';
      x.fillText('ACADEX · ÖĞRENCİ', cx + (logo ? 122 : 48), cy + 92);
      x.strokeStyle = '#DCE2EE'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx + 48, cy + 146); x.lineTo(cx + cw - 48, cy + 146); x.stroke();
      /* avatar */
      x.save(); roundRect(x, cx + 48, cy + 180, 260, 260, 28); x.clip(); x.drawImage(av, cx + 48, cy + 180, 260, 260); x.restore();
      /* yazılar */
      var tx = cx + 352, tw = cw - 352 - 48;
      x.fillStyle = '#6A7593'; x.font = '500 18px "JetBrains Mono", monospace'; x.fillText('AD', tx, cy + 200);
      x.fillStyle = '#0D1838'; fitText(x, name, tw, 68, '600 {s}px Caveat, "Segoe Print", cursive'); x.fillText(name, tx, cy + 252);
      x.fillStyle = '#6A7593'; x.font = '500 18px "JetBrains Mono", monospace'; x.fillText('BÖLÜM', tx, cy + 318);
      x.fillStyle = '#33405F'; fitText(x, dept, tw, 28, '500 {s}px "Instrument Sans", system-ui, sans-serif'); x.fillText(dept, tx, cy + 352);
      x.fillStyle = '#1A2A5C'; x.font = '500 22px "JetBrains Mono", monospace'; x.fillText('Pilot · ' + new Date().getFullYear(), tx, cy + 410);
      /* barkod */
      var bx = cx + 48, by = cy + 476;
      for (var i = 0, px = bx; px < cx + 560; i++) { var w = [2, 4, 2, 6, 3, 2, 5][i % 7]; x.fillStyle = '#1A2A5C'; x.fillRect(px, by, w, 50); px += w + [3, 2, 4, 2, 3][i % 5]; }
      /* damga */
      x.save(); x.translate(cx + cw - 150, cy + 500); x.rotate(-0.16);
      x.strokeStyle = 'rgba(201,72,59,0.85)'; x.lineWidth = 4; roundRect(x, -84, -30, 168, 60, 10); x.stroke();
      x.fillStyle = 'rgba(201,72,59,0.85)'; x.font = '700 30px "JetBrains Mono", monospace'; x.textAlign = 'center'; x.fillText('PİLOT', 0, 2);
      x.restore(); x.textAlign = 'left';
      /* el yazısı not */
      x.fillStyle = '#9DB8FF'; x.font = '600 44px Caveat, "Segoe Print", cursive'; x.textAlign = 'center';
      x.fillText('notunu getir, sınava hazır çık.', W / 2, H - 200);
      x.fillStyle = '#8FA2CC'; x.font = '500 22px "JetBrains Mono", monospace'; x.fillText('acadex · öğrenci kartı', W / 2, H - 136);
      try { URL.revokeObjectURL(av.src); } catch (e) { /* yok */ }
      return canvasBlob(cv);
    });
  };
  var idCard = function (btn) {
    if (btn.disabled) return;
    btn.disabled = true; var old = btn.textContent; btn.textContent = 'Hazırlanıyor…';
    loadLib().then(cardBlob).then(function (blob) {
      var file = null;
      try { file = new File([blob], 'acadex-ogrenci-karti.png', { type: 'image/png' }); } catch (e) { /* eski tarayıcı */ }
      if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        return navigator.share({ files: [file], title: 'Acadex öğrenci kartım' }).catch(function (e) { if (e && e.name !== 'AbortError') saveBlob(blob, 'acadex-ogrenci-karti.png'); });
      }
      saveBlob(blob, 'acadex-ogrenci-karti.png');
    }).catch(function (e) { console.error('öğrenci kartı', e); alertMsg('error', 'Öğrenci kartı hazırlanamadı. Biraz sonra tekrar dener misin?'); })
      .then(function () { btn.disabled = false; btn.textContent = old; });
  };

  var save = function () {
    if (busy) return;
    var sb = g('supabaseClient'), user = g('currentUser'), p = profile();
    if (!sb || !user || !user.id) { alertMsg('error', 'Oturum bulunamadı, sayfayı yenileyip tekrar dener misin?'); return; }
    busy = true;
    var okBtn = back.querySelector('[data-avs-save]'); okBtn.disabled = true; okBtn.textContent = 'Kaydediliyor…';
    var tag = encodeCfg(cfg), saved = assign({}, cfg);
    var finish = function (url, note) {
      var oldUrl = p && p.avatar_url;
      return sb.from('profiles').update({ avatar_url: url }).eq('id', user.id).then(function (r) {
        if (r && r.error) throw r.error;
        if (p) p.avatar_url = url;
        retire(oldUrl, url);
        ls.set('acx-avatar-cfg', saved);
        var up = window.updateAllAvatarDisplays || g('updateAllAvatarDisplays'); if (typeof up === 'function') up();
        alertMsg('success', note || 'Avatarın kaydedildi.');
        close();
        setTimeout(liveScan, 60);
      });
    };
    loadLib().then(function () { return pngOf(cfg, 512); }).then(function (blob) {
      var path = user.id + '/' + FILE;
      return sb.storage.from('avatars').upload(path, blob, { upsert: true, cacheControl: '3600', contentType: 'image/png' }).then(function (r) {
        if (r && r.error) throw r.error;
        var pub = sb.storage.from('avatars').getPublicUrl(path);
        var base = pub && pub.data && pub.data.publicUrl;
        if (!base) throw new Error('public url');
        return finish(base + '?v=' + Date.now() + '&acx=' + tag);
      });
    }).catch(function (err) {
      /* depoya yüklenemezse: DiceBear adresiyle kaydet ki avatar yine de görünsün (rozet parçaları bu yolda görünmez) */
      console.warn('Avatar depoya yüklenemedi, DiceBear adresiyle kaydediliyor.', err);
      return finish(apiUrl(cfg) + '&acx=' + tag, 'Avatarın kaydedildi (sunucuya yüklenemediği için geçici bağlantıyla).');
    }).catch(function (err) {
      console.error('Avatar kaydedilemedi', err);
      alertMsg('error', 'Avatar kaydedilemedi: ' + ((err && err.message) || 'bilinmeyen hata'));
    }).then(function () { busy = false; okBtn.disabled = false; okBtn.textContent = 'Kaydet'; });
  };

  var removeIt = function () {
    var f = g('removeAvatar');
    if (typeof f === 'function') { f(); close(); }
  };

  /* ---------- canlı kart: eğilme, ışık, göz kırpma ---------- */
  var tiltTo = function (el, px, py, range, max) {
    if (!el || reduce()) return;
    var r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var dx = Math.max(-1, Math.min(1, (px - cx) / range)), dy = Math.max(-1, Math.min(1, (py - cy) / range));
    el.classList.remove('idle'); el.classList.add('moving');
    el.style.setProperty('--ry', (dx * max).toFixed(2) + 'deg'); el.style.setProperty('--rx', (-dy * max).toFixed(2) + 'deg');
    el.style.setProperty('--sx', dx.toFixed(3)); el.style.setProperty('--sy', dy.toFixed(3));
    clearTimeout(el.__avsT); el.__avsT = setTimeout(function () { el.classList.remove('moving'); }, 160);
  };
  var tiltReset = function (el) { if (!el) return; ['--rx', '--ry', '--sx', '--sy'].forEach(function (k) { el.style.setProperty(k, k.indexOf('r') === 2 ? '0deg' : '0'); }); el.classList.remove('moving'); };

  /* panelde kullanıcının kendi avatarını taşıyan resimleri bul ve canlandır */
  var mood = null, lives = [];
  var myCfg = function () { var p = profile(); return cfgFromUrl(p && p.avatar_url); };
  var isMine = function (img) { var p = profile(); return !!(p && p.avatar_url && img.getAttribute('src') === p.avatar_url); };
  var liven = function (img) {
    if (img.__avs || img.closest('.avs-back') || !isMine(img)) return;
    var c = myCfg(); if (!c) return;
    var size = img.getBoundingClientRect().width || parseFloat(img.getAttribute('width')) || parseFloat(img.style.width) || 0;
    if (size && size < 20) return;
    img.__avs = true;
    var wrap = document.createElement('span'); wrap.className = 'avs-live';
    var cs = getComputedStyle(img); wrap.style.borderRadius = cs.borderRadius;
    /* resim kutusunu dolduruyorsa (ör. .ax-av img{width:100%}) sarmalayıcı da doldursun */
    var ir = img.getBoundingClientRect(), par = img.parentNode, pcs = getComputedStyle(par);
    var innerW = par.clientWidth - parseFloat(pcs.paddingLeft) - parseFloat(pcs.paddingRight), innerH = par.clientHeight - parseFloat(pcs.paddingTop) - parseFloat(pcs.paddingBottom);
    if (ir.width && Math.abs(innerW - ir.width) < 3 && Math.abs(innerH - ir.height) < 3) { wrap.style.width = '100%'; wrap.style.height = '100%'; }
    var big = size >= 56;
    if (big) wrap.classList.add('tilt');
    img.parentNode.insertBefore(wrap, img); wrap.appendChild(img);
    /* emniyet: sarınca boyut değiştiyse eski boyuta sabitle */
    var nr = img.getBoundingClientRect();
    if (ir.width && (Math.abs(nr.width - ir.width) > 1 || Math.abs(nr.height - ir.height) > 1)) { wrap.style.width = ir.width + 'px'; wrap.style.height = ir.height + 'px'; img.style.width = '100%'; img.style.height = '100%'; }
    var moodEl = document.createElement('img'); moodEl.className = 'avs-ov avs-mood'; moodEl.alt = ''; moodEl.setAttribute('aria-hidden', 'true');
    var blinkEl = document.createElement('img'); blinkEl.className = 'avs-ov avs-blink'; blinkEl.alt = ''; blinkEl.setAttribute('aria-hidden', 'true');
    [moodEl, blinkEl].forEach(function (o) { o.style.objectFit = cs.objectFit || 'cover'; wrap.appendChild(o); });
    if (big) { var sh = document.createElement('i'); sh.className = 'avs-sheen'; sh.setAttribute('aria-hidden', 'true'); wrap.appendChild(sh); }
    img.addEventListener('error', function () { unwrap(wrap); });
    lives.push(wrap); paintLive(wrap);
    if (big && !reduce()) wrap.classList.add('idle');
  };
  var unwrap = function (wrap) {
    var img = wrap.querySelector('img:not(.avs-ov)');
    if (img && wrap.parentNode) { wrap.parentNode.insertBefore(img, wrap); img.__avs = false; }
    if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    lives = lives.filter(function (w) { return w !== wrap; });
  };
  var paintLive = function (wrap) {
    var c = myCfg(); if (!c) return;
    var m = mood && MOODS[mood], moodEl = wrap.querySelector('.avs-mood'), blinkEl = wrap.querySelector('.avs-blink');
    var face = m ? withExpr(c, m) : c;
    if (m) srcAsync(face).then(function (s) { moodEl.onload = function () { moodEl.classList.add('on'); }; moodEl.src = s; });
    else moodEl.classList.remove('on');
    srcAsync(withExpr(face, BLINK)).then(function (s) { blinkEl.src = s; });
  };
  var liveScan = function () {
    lives = lives.filter(function (w) { if (!document.contains(w)) return false; var img = w.querySelector('img:not(.avs-ov)'); if (!img || !isMine(img)) { unwrap(w); return false; } return true; });
    var p = profile(); if (!p || !p.avatar_url || !myCfg()) return;
    Array.prototype.forEach.call(document.querySelectorAll('img'), function (img) { if (!img.__avs && isMine(img)) liven(img); });
  };
  var blinkLoop = function () {
    if (!reduce() && !document.hidden) {
      lives.forEach(function (w) {
        var r = w.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
        w.classList.add('blink'); setTimeout(function () { w.classList.remove('blink'); }, 150);
      });
      if (back && !back.hidden) { var pv = back.querySelector('[data-avs-live]'); pv.classList.add('blink'); setTimeout(function () { pv.classList.remove('blink'); }, 150); }
    }
    setTimeout(blinkLoop, 3200 + Math.random() * 2600);
  };
  var tiltLoop = function () {
    var raf = 0, lx = 0, ly = 0;
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return; lx = e.clientX; ly = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        lives.forEach(function (w) { if (w.classList.contains('tilt')) tiltTo(w, lx, ly, 420, 12); });
      });
    }, { passive: true });
    /* telefonda: izin istemeyen tarayıcılarda eğim sensörü, yoksa yavaş salınım */
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== 'function') {
      window.addEventListener('deviceorientation', function (e) {
        if (e.gamma == null) return;
        var gx = Math.max(-1, Math.min(1, e.gamma / 30)), gy = Math.max(-1, Math.min(1, ((e.beta || 45) - 45) / 30));
        lives.forEach(function (w) { if (!w.classList.contains('tilt')) return; var r = w.getBoundingClientRect(); tiltTo(w, r.left + r.width / 2 + gx * 420, r.top + r.height / 2 + gy * 420, 420, 10); });
      }, { passive: true });
    }
  };

  /* ---------- her yerde aynı avatar: kaydedince sayfadaki eski resimler de anında değişir ---------- */
  var retired = {};
  var retire = function (from, to) {
    if (!from || !to || from === to) return;
    retired[from] = to;
    Object.keys(retired).forEach(function (k) { if (retired[k] === from) retired[k] = to; });
    swapOld();
  };
  var swapOld = function () {
    if (!Object.keys(retired).length) return;
    Array.prototype.forEach.call(document.querySelectorAll('img'), function (im) { var s0 = im.getAttribute('src'); if (s0 && retired[s0]) im.setAttribute('src', retired[s0]); });
  };

  /* ---------- ruh hali: avatar o anki duruma göre yüz ifadesi takınır ----------
     öncelik: Pomodoro odak turu > yeni bitmiş sınavın sonucu (2 saat) > bugün çalıştın > uzun aradan sonra özlem */
  var EXAM_KEY = 'acx-mood-exam', pomFocus = false, baseMood = null;
  var computeMood = function () {
    if (pomFocus) return 'odak';
    var ex = ls.get(EXAM_KEY); if (ex && ex.until > Date.now() && MOODS[ex.m]) return ex.m;
    var st = ls.get('acx-mood') || {}; if (st.studied === today()) return 'mutlu';
    return baseMood;
  };
  var setMood = function (m) { if (mood === m) return; mood = m; lives.forEach(paintLive); };
  var moodNow = function () { setMood(computeMood()); };
  var markStudied = function () {
    var st = ls.get('acx-mood') || {}; st.studied = today(); ls.set('acx-mood', st); baseMood = null; moodNow();
  };
  /* üst bardaki avatarın yanında küçük el yazısı balon */
  var say = function (text, delay) {
    setTimeout(function () {
      /* yalnızca gerçekten görünen (üstü kapanmamış) bir avatarın yanında konuş */
      var w = lives.filter(function (x) {
        var r = x.getBoundingClientRect(); if (!r.width || r.top < 0 || r.top >= 160) return false;
        var hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!hit && (hit === x || x.contains(hit));
      })[0];
      if (!w) return;
      injectCss();
      Array.prototype.forEach.call(document.querySelectorAll('.avs-miss'), function (o) { o.remove(); });
      var r = w.getBoundingClientRect(), b = document.createElement('div'); b.className = 'avs-miss'; b.setAttribute('role', 'status'); b.textContent = text;
      document.body.appendChild(b);
      b.style.left = Math.max(8, Math.min(innerWidth - b.offsetWidth - 8, r.left + r.width / 2 - b.offsetWidth / 2)) + 'px';
      b.style.top = (r.bottom + 10) + 'px';
      setTimeout(function () { b.remove(); }, 5000);
    }, delay == null ? 300 : delay);
  };
  var initMood = function () {
    var st = ls.get('acx-mood') || {}, t = today();
    if (st.studied !== t && st.last && dayDiff(st.last, t) >= 3) { baseMood = 'ozlemis'; if (st.missShown !== t) { st.missShown = t; say('seni özledim!', 1200); } }
    st.last = t; ls.set('acx-mood', st);
    mood = computeMood();
    /* çalışma sinyali: panelin başarı bildirimleri (özet, kart, sınav, defter kaydı...) */
    var prev = window.showDashboardAlert;
    if (typeof prev === 'function' && !prev.__avs) {
      var wrapped = function (type, msg) {
        try { if (type === 'success' && !/avatar|fotoğraf|kapak|stil/i.test(String(msg || ''))) markStudied(); } catch (e) { /* yok */ }
        return prev.apply(this, arguments);
      };
      wrapped.__avs = true; window.showDashboardAlert = wrapped;
    }
  };
  /* Pomodoro: Study Lab'in üst çubuktaki sayaç çipi odak turundayken görünür */
  var pomWatch = function () {
    var chip = document.getElementById('axl-chip'); if (!chip || chip.__avs) return; chip.__avs = true;
    var check = function (first) {
      var f = !chip.hidden && !chip.classList.contains('brk') && !chip.classList.contains('paused');
      if (f === pomFocus) return;
      pomFocus = f; moodNow();
      if (!first) say(f ? 'odaktayım, sonra konuşuruz' : (chip.hidden ? 'tur bitti, aferin!' : 'kısa bir mola'), 150);
    };
    new MutationObserver(function () { check(false); }).observe(chip, { attributes: true, attributeFilter: ['hidden', 'class'] });
    check(true);
  };
  /* sınav: yeni gönderilen bir denemenin sonucu açılınca puana göre yüz */
  var examAt = 0;
  var examMood = function (exam) {
    var gr = Math.round(+(exam && exam.grade) || 0);
    var m = gr >= 70 ? 'gurur' : gr >= 50 ? 'mutlu' : 'dusunceli';
    ls.set(EXAM_KEY, { m: m, until: Date.now() + 2 * 3600e3 });
    var st = ls.get('acx-mood') || {}; st.studied = today(); ls.set('acx-mood', st); baseMood = null;
    moodNow();
    setTimeout(function () {
      var host = document.querySelector('.sn-score') || document.getElementById('result-score-circle');
      if (host && myCfg()) addSticker(host, gr >= 85 ? 'heyecanli' : m, true);
      else say(gr >= 85 ? 'harikayız!' : gr >= 70 ? 'gurur duydum!' : gr >= 50 ? 'fena değil, devam!' : 'bir daha deneriz, olur', 400);
    }, 120);
  };
  var examWatch = function () {
    var sub = window.submitExam;
    if (typeof sub === 'function' && !sub.__avs) { var ws = function () { examAt = Date.now(); return sub.apply(this, arguments); }; ws.__avs = true; window.submitExam = ws; }
    var show = window.showExamResults;
    if (typeof show === 'function' && !show.__avs) {
      var wr = function (exam) {
        var r = show.apply(this, arguments);
        try { if (examAt && Date.now() - examAt < 15 * 60e3) { examAt = 0; examMood(exam); } } catch (e) { /* yok */ }
        return r;
      };
      wr.__avs = true; window.showExamResults = wr;
    }
  };

  /* ---------- Acadia: senin mesajlarında avatarın, cevap beklerken düşünür, cevap gelince göz kırpar ---------- */
  var acadia = function () {
    var layer = document.getElementById('axa-layer'); if (!layer || layer.__avs) return;
    var log = layer.querySelector('[data-log]'), P = layer.querySelector('[data-axa]'); if (!log || !P) return;
    layer.__avs = true;
    var lastMe = function () { var l = log.querySelectorAll('.avs-me-av'); return l[l.length - 1] || null; };
    var face = function (im, key) {
      var c = myCfg(), p = profile(); if (!im || !p || !p.avatar_url) return;
      clearTimeout(im.__avsT);
      if (!key || !c) { im.src = p.avatar_url; return; }
      srcAsync(withExpr(c, MOODS[key])).then(function (s0) { im.src = s0; });
    };
    var tag = function (m) {
      var p = profile(); if (m.__avs || !p || !p.avatar_url) return;
      m.__avs = true; m.classList.add('avs-me');
      var im = document.createElement('img'); im.className = 'avs-me-av'; im.alt = ''; im.setAttribute('aria-hidden', 'true'); im.__avs = true;
      im.src = p.avatar_url; im.onerror = function () { im.remove(); m.classList.remove('avs-me'); };
      m.appendChild(im);
    };
    Array.prototype.forEach.call(log.querySelectorAll('.axa-m.user'), tag);
    new MutationObserver(function (ms) {
      ms.forEach(function (mu) { Array.prototype.forEach.call(mu.addedNodes, function (n) { if (n.nodeType === 1 && n.classList.contains('axa-m') && n.classList.contains('user')) tag(n); }); });
    }).observe(log, { childList: true });
    var was = P.classList.contains('busy');
    new MutationObserver(function () {
      var on = P.classList.contains('busy'); if (on === was) return; was = on;
      var im = lastMe(); if (!im) return;
      if (on) { face(im, 'dusunceli'); return; }
      var bots = log.querySelectorAll('.axa-m.bot'), lb = bots[bots.length - 1];
      face(im, lb && lb.classList.contains('err') ? 'saskin' : 'kirpan');
      im.__avsT = setTimeout(function () { face(im, null); }, 2600);
    }).observe(P, { attributes: true, attributeFilter: ['class'] });
  };

  /* ---------- sticker'lar: Acadia önerisi + başarı bildirimi ---------- */
  var stickerSrc = function (key) {
    var c = myCfg(); if (!c) return null; /* fotoğraf ya da eski avatar: sticker yok */
    var ex = EXPR.filter(function (x) { return x.k === key; })[0] || MOODS[key] || EXPR[0];
    return srcOf(withExpr(c, ex), true);
  };
  var addSticker = function (host, key, replace) {
    if (!host) return;
    var old = host.querySelector(':scope > .avs-st'); if (old) { if (!replace) return; old.remove(); }
    var src = stickerSrc(key); if (!src) return;
    injectCss();
    var im = document.createElement('img'); im.className = 'avs-st'; im.alt = ''; im.setAttribute('aria-hidden', 'true'); im.src = src;
    im.onerror = function () { im.remove(); };
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.insertBefore(im, host.firstChild);
  };
  var watchHint = function (el) {
    if (!el || el.__avs) return; el.__avs = true;
    var put = function () { if (!el.hidden) addSticker(el, 'dusunceli'); };
    new MutationObserver(put).observe(el, { childList: true, attributes: true, attributeFilter: ['hidden'] });
    put();
  };
  var watchToasts = function (box) {
    if (!box || box.__avs) return; box.__avs = true;
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1 && n.classList.contains('achievement-toast')) { markStudied(); addSticker(n, 'heyecanli'); } }); });
    }).observe(box, { childList: true });
  };

  var boot = function () {
    injectCss();
    var tries = 0;
    var look = function () {
      watchHint(document.querySelector('.axa-hint'));
      watchToasts(document.getElementById('achievement-toast-container'));
      pomWatch(); acadia(); examWatch();
      liveScan();
      if (++tries < 30 && (!document.querySelector('.axa-hint') || !lives.length || !document.getElementById('axl-chip'))) setTimeout(look, 1000);
    };
    /* yeni eklenen avatar resimlerini ve bildirim kutusunu yakala (toplu, kare başına bir kez) */
    var pend = false;
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1) { if (n.id === 'achievement-toast-container') watchToasts(n); if (n.classList && n.classList.contains('axa-hint')) watchHint(n); } }); });
      if (!pend) { pend = true; requestAnimationFrame(function () { pend = false; swapOld(); liveScan(); }); }
    }).observe(document.body, { childList: true, subtree: true });
    initMood();
    loadLib().then(function () { lives.forEach(paintLive); });
    look();
    blinkLoop(); tiltLoop();
  };

  /* ---------- dışarıya açılan ---------- */
  window.openAvatarBuilder = open;
  window.closeAvatarBuilder = close;
  window.AcxAvatar = { open: open, close: close, sticker: stickerSrc, expressions: EXPR.map(function (x) { return x.k; }), moods: Object.keys(MOODS), markStudied: markStudied, mood: function () { return mood; } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
