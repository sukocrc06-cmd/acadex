/* ==========================================================================
   ACADEX KIDS · CANLI KELİMELER (kids/assets/kids-canli.js + kids-canli.css), 20.11.2026
   Kelime resmi gelip durmasın, kendi dünyasında yaşasın:
     - GİRİŞ (İzle sahnesi): kelimeye özel yol. Otobüs/taksi yolda tekerleği dönerek gelir
       (altında yol akar), tren rayda, gemi dalgada, uçak gökten süzülür, roket aşağıdan kalkar,
       kuş kanat çırparak, ördek paytak paytak, kurbağa hoplayarak, yılan kıvrılarak, top
       yuvarlanarak gelir.
     - DURUNCA DA OYNAR: otobüsün motoru titrer, egzozdan duman çıkar; balık yüzer, baloncuk
       çıkarır; köpek nefes alır, başını sallar; çorbadan buhar tüter; davuldan nota uçar;
       güneş parlar, yağmur yağar, kar yağar; uykulu yüzden zzz çıkar…
   Nerede: İzle sahnesi (giriş + sahne + parçacık), konu ekranındaki "Kelime ustalığı"
   kutuları, Kelimelerim, oyunlarda doğru cevap (yalnız hareket; kutular küçük olduğu için
   parçacık yok). Hareketi azalt açıksa hiçbiri oynamaz (CSS).
   Bağlantı: kids-resim.js / kids-hayvan.js ciz() resmin svg'sine "kcn kcn-o-<hareket>"
   sınıfını ekler (W.KIDS_CANLI.sinif); kids-anlat.js sahnede giriş + zemin + parçacık ekler.
   W.KIDS_CANLI = { bilgi(id), sinif(id), ekHtml(bilgi), zeminHtml(bilgi) }
   ========================================================================== */
(function (W) {
  'use strict';
  /* g: giriş, o: durunca hareket, p: parçacık, z: zemin, s: giriş süresi (ms) */
  var T = {};
  function ekle(ids, b) { ids.split(' ').forEach(function (id) { T[id] = Object.assign({}, T[id] || {}, b); }); }

  /* --- taşıtlar --- */
  ekle('bus taxi truck van jeep tractor digger car', { g: 'yol', o: 'motor', p: 'duman', z: 'yol', s: 1300 });
  ekle('ambulance fireengine policecar', { g: 'yol', o: 'motor', p: 'siren', z: 'yol', s: 1300 });
  ekle('motorbike', { g: 'yol', o: 'motor', p: 'duman', z: 'yol', s: 1300 });
  ekle('bike scooter skateboard', { g: 'yol', o: 'kos', z: 'yol', s: 1300 });
  ekle('train', { g: 'ray', o: 'motor', p: 'buhar', z: 'ray', s: 1500 });
  ekle('tram', { g: 'ray', o: 'motor', z: 'ray', s: 1500 });
  ekle('ship sailboat canoe toyboat', { g: 'deniz', o: 'dalga', z: 'deniz', s: 1500 });
  ekle('submarine', { g: 'dalis', o: 'suzul', p: 'kabarcik', s: 1400 });
  ekle('plane helicopter', { g: 'gok', o: 'ucak', p: 'bulut', s: 1300 });
  ekle('hotairballoon balloon kite', { g: 'gokyavas', o: 'sallan', p: 'bulut', s: 1600 });
  ekle('rocket', { g: 'roket', o: 'titre', p: 'alev', s: 1200 });
  /* --- hayvanlar --- */
  ekle('cat dog cow lion bear horse pig sheep elephant giraffe tiger mouse zebra panda fox goat hippo', { g: 'yuru', o: 'nefes2', s: 1000 });
  ekle('bird owl butterfly', { g: 'kanat', o: 'kanat', s: 1400 });
  ekle('bee', { g: 'kanat', o: 'vizilti', s: 1400 });
  ekle('duck penguin hen chick', { g: 'paytak', o: 'paytak', s: 1500 });
  ekle('frog rabbit monkey squirrel', { g: 'zipla2', o: 'zipla', s: 1500 });
  ekle('snake crocodile eel', { g: 'surun', o: 'surun', s: 1500 });
  ekle('fish whale dolphin octopus shark seahorse squid stingray swordfish clownfish turtle seal walrus', { g: 'yuz', o: 'yuz', p: 'kabarcik', s: 1100 });
  ekle('jellyfish', { g: 'dalis', o: 'denizanasi', p: 'kabarcik', s: 1400 });
  ekle('pufferfish', { g: 'yuz', o: 'sisir', p: 'kabarcik', s: 1100 });
  ekle('crab lobster', { g: 'yan', o: 'yan', p: 'kabarcik', s: 1300 });
  ekle('starfish shell coral seaweed anchor', { o: 'sallan2', p: 'kabarcik' });
  /* --- yiyecek, meyve --- */
  ekle('bread soup pizza rice chicken pasta burger chips pancake sausage corn popcorn potato egg', { o: 'jole', p: 'buhar' });
  ekle('icecream lollipop sweets juice milk yoghurt cake cookie chocolate honey cheese sandwich salad', { o: 'jole', p: 'parilti' });
  ekle('apple banana strawberry carrot tomato orangefruit grapes pear lemon watermelon cherries pineapple peach kiwi mango plum apricot fig melon raspberry blueberries coconut avocado pomegranate lime tangerine quince', { o: 'sallan2', p: 'parilti' });
  /* --- oyuncaklar --- */
  ekle('ball marbles dice', { g: 'yuvarlan', o: 'sek', s: 1300 });
  ekle('teddy doll puppet robot dinosaur', { o: 'dans' });
  ekle('drum piano guitar trumpet xylophone whistle', { o: 'cal', p: 'nota' });
  ekle('spintop', { o: 'topac' });
  ekle('yoyo', { o: 'yoyo' });
  ekle('swing', { o: 'salincak' });
  ekle('rockinghorse', { o: 'sallanat' });
  ekle('bubbles', { o: 'suzul', p: 'kabarcik' });
  /* --- hava --- */
  ekle('sunny sun hot warm sunrise summer beach', { o: 'gunes', p: 'isin' });
  ekle('rainy rain cloud cloudy puddle umbrella wet', { o: 'sallan', p: 'yagmur' });
  ekle('snowy snow snowman ice cold hail winter snowflake sledge', { o: 'titre2', p: 'kar' });
  ekle('windy wind tornado', { o: 'ruzgar', p: 'ruzgar' });
  ekle('stormy lightning thunder', { o: 'titre', p: 'simsek' });
  ekle('rainbow', { o: 'parla', p: 'parilti' });
  ekle('moon nightsky', { o: 'suzul', p: 'yildizcik' });
  ekle('foggy', { o: 'suzul' });
  ekle('spring flower leaf autumn', { o: 'sallan2', p: 'parilti' });
  /* --- duygular, eylemler --- */
  ekle('happy excited silly proud laugh', { o: 'zipla' });
  ekle('loved', { o: 'zipla', p: 'kalp' });
  ekle('sad lonely hurt sick cry', { o: 'sarkik' });
  ekle('angry grumpy', { o: 'titre' });
  ekle('scared nervous worried embarrassed shy', { o: 'titre2' });
  ekle('tired sleepy bored sleep', { o: 'nefes', p: 'zzz' });
  ekle('surprised curious confused', { o: 'kafa' });
  ekle('run walk ride', { o: 'kos' });
  ekle('jump', { o: 'zipla' });
  ekle('swim', { o: 'yuz', p: 'kabarcik' });
  ekle('sing', { o: 'sallan', p: 'nota' });
  ekle('dance', { o: 'dans', p: 'nota' });
  ekle('fly', { o: 'ucak' });
  ekle('climb', { o: 'tirman' });
  ekle('clap', { o: 'cal' });
  ekle('astronaut', { o: 'suzul', p: 'yildizcik' });
  /* --- şekiller, giysiler --- */
  ekle('circle square triangle star rectangle heart oval diamond hexagon pentagon semicircle crescent arrow', { o: 'don' });
  ekle('cube cone cylinder', { o: 'don3' });
  ekle('hat tshirt dress coat scarf trousers skirt shorts jacket sweater pyjamas shirt jeans raincoat swimsuit apron tie ribbon necklace', { o: 'askida' });

  function bilgi(id) { var b = T[id]; return b ? { g: b.g || '', o: b.o || 'nefes', p: b.p || '', z: b.z || '', s: b.s || 0 } : { g: '', o: 'nefes', p: '', z: '', s: 0 }; }
  function sinif(id) { return 'kcn kcn-o-' + bilgi(id).o; }
  /* parçacıklar: sabit sayıda <i>, konumları CSS'te */
  var SAY = { duman: 4, buhar: 3, kabarcik: 6, nota: 3, zzz: 3, kalp: 4, parilti: 5, yagmur: 7, kar: 7, isin: 1, ruzgar: 4, simsek: 1, yildizcik: 5, bulut: 2, alev: 2, siren: 2 };
  var IC = { nota: ['♪', '♫', '♪'], zzz: ['z', 'Z', 'z'], kalp: ['♥', '♥', '♥', '♥'] };
  function ekHtml(b) {
    if (!b || !b.p || !SAY[b.p]) return '';
    var s = '', ic = IC[b.p] || [];
    for (var i = 0; i < SAY[b.p]; i++) s += '<i style="--k:' + i + '">' + (ic[i] || '') + '</i>';
    return '<span class="kcn-p kcn-p-' + b.p + '" aria-hidden="true">' + s + '</span>';
  }
  function zeminHtml(b) { return b && b.z ? '<span class="kcn-zemin kcn-z-' + b.z + '" aria-hidden="true"><i></i></span>' : ''; }

  W.KIDS_CANLI = { bilgi: bilgi, sinif: sinif, ekHtml: ekHtml, zeminHtml: zeminHtml, _T: T };
})(window);
