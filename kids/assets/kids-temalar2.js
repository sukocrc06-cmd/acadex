/* ==========================================================================
   ACADEX KIDS · ikinci kat kelimeler ve ikinci takımada (kids/assets/kids-temalar2.js), 12.11.2026
   1) İlk on temanın her birine +10 kelime (Yıldızlar 20 kelimeyle oynar, Kâşifler 10).
   2) On yeni tema: Fruits, Transport, Shapes, Sea, Jobs, Actions, Seasons, Days,
      Places (in/on/under…), Alphabet. Her biri kendi oyunu, şarkısı, çıkartması ve
      "evde 5 dakika" etkinliğiyle.
   3) Karışık durak (kids-oyun2 "karisik"): sayı × renk × kelime birleşimiyle sınırsız
      soru ("Find three red cars!"). karisik: 'renk' = sayı ve renk, 'say' = yalnız sayı.
   Şarkılar ve hikâye cümleleri Acadex için yazıldı.
   ========================================================================== */
(function (W) {
  'use strict';
  var T = W.KIDS_TEMALAR, K = W.KIDS_KONU, o = T.o, tema = T.tema;
  function ekle(id, l) { var p = K.al(id); l.forEach(function (x) { p.liste.push(x); }); return p; }
  var kucuk = function (x) { return x.en.toLowerCase(); }, pop = function (x) { return 'Pop the ' + kucuk(x) + '!'; };

  /* ---------------- 1) ikinci kat ---------------- */
  ekle('animals', [o('horse', 'horse', 'at', '#B07A40', { ses: 'Neigh' }), o('pig', 'pig', 'domuz', '#F06A95', { ses: 'Oink' }), o('sheep', 'sheep', 'koyun', '#7C8AA3', { ses: 'Baa', cogul: 'sheep' }), o('duck', 'duck', 'ördek', '#E8A400', { ses: 'Quack' }),
    o('monkey', 'monkey', 'maymun', '#9A6A42', { ses: 'Ooh, ooh' }), o('elephant', 'elephant', 'fil', '#7C8AA3', { ses: 'Toot', bir: 'an' }), o('giraffe', 'giraffe', 'zürafa', '#E0A21A'), o('tiger', 'tiger', 'kaplan', '#FF7A1A'),
    o('mouse', 'mouse', 'fare', '#8A94A8', { ses: 'Squeak', cogul: 'mice' }), o('snake', 'snake', 'yılan', '#3FB86A', { ses: 'Hiss' })]);
  ekle('family', [o('boy', 'boy', 'erkek çocuk', '#2E8FE8', { the: 1 }), o('girl', 'girl', 'kız çocuk', '#FF6FA5', { the: 1 }), o('man', 'man', 'adam', '#5B6478', { the: 1 }), o('woman', 'woman', 'kadın', '#3FB86A', { the: 1 }),
    o('friend', 'friend', 'arkadaş', '#8E7CF0', { the: 1 }), o('cousin', 'cousin', 'kuzen', '#E8B820'), o('parents', 'parents', 'anne baba', '#2E8FE8', { the: 1, cok: 1 }), o('grandparents', 'grandparents', 'büyükanne ve büyükbaba', '#B58AE0', { cok: 1 }),
    o('twins', 'twins', 'ikizler', '#FF8A3D', { the: 1, cok: 1 }), o('pet', 'pet', 'evcil hayvan', '#D9A35E', { the: 1 })]);
  ekle('body', [o('face', 'face', 'yüz', '#E8875A'), o('fingers', 'fingers', 'parmaklar', '#E8B820', { cok: 1 }), o('toes', 'toes', 'ayak parmakları', '#F06A95', { cok: 1 }), o('teeth', 'teeth', 'dişler', '#2E8FE8', { cok: 1 }),
    o('tongue', 'tongue', 'dil', '#E5484D'), o('neck', 'neck', 'boyun', '#1FA597'), o('shoulders', 'shoulders', 'omuzlar', '#2E8FE8', { cok: 1 }), o('knees', 'knees', 'dizler', '#8E7CF0', { cok: 1 }),
    o('tummy', 'tummy', 'karın', '#3FB86A'), o('cheeks', 'cheeks', 'yanaklar', '#FF6FA5', { cok: 1 })]);
  ekle('food', [o('pizza', 'pizza', 'pizza', '#E5484D', { bir: 'pizza', cok: 'pizza', tek: 1 }), o('sandwich', 'sandwich', 'sandviç', '#C98A4B', { bir: 'a sandwich', cok: 'sandwiches' }), o('soup', 'soup', 'çorba', '#E5484D', { bir: 'soup', cok: 'soup', tek: 1 }),
    o('rice', 'rice', 'pirinç pilavı', '#2E8FE8', { bir: 'rice', cok: 'rice', tek: 1 }), o('cookie', 'cookie', 'kurabiye', '#B07A40', { bir: 'a cookie', cok: 'cookies' }), o('icecream', 'ice cream', 'dondurma', '#FF6FA5', { bir: 'ice cream', cok: 'ice cream', tek: 1 }),
    o('chicken', 'chicken', 'tavuk', '#C98A4B', { bir: 'chicken', cok: 'chicken', tek: 1 }), o('pasta', 'pasta', 'makarna', '#E8A400', { bir: 'pasta', cok: 'pasta', tek: 1 }), o('honey', 'honey', 'bal', '#E8A400', { bir: 'honey', cok: 'honey', tek: 1 }),
    o('chocolate', 'chocolate', 'çikolata', '#7A4A2A', { bir: 'chocolate', cok: 'chocolate', tek: 1 })]);
  ekle('toys', [o('puzzle', 'puzzle', 'yapboz', '#2E8FE8', { bir: 'a puzzle' }), o('yoyo', 'yo-yo', 'yoyo', '#E5484D', { bir: 'a yo-yo' }), o('dinosaur', 'dinosaur', 'dinozor', '#3FB86A', { bir: 'a dinosaur' }), o('bubbles', 'bubbles', 'baloncuklar', '#3BAED8', { bir: 'bubbles', cok: 1 }),
    o('skateboard', 'skateboard', 'kaykay', '#FF7A1A', { bir: 'a skateboard' }), o('dice', 'dice', 'zar', '#E5484D', { bir: 'a dice', cogul: 'dice' }), o('marbles', 'marbles', 'bilyeler', '#3FB86A', { bir: 'marbles', cok: 1 }), o('piano', 'piano', 'piyano', '#8F5A3A', { bir: 'a piano' }),
    o('whistle', 'whistle', 'düdük', '#E8B820', { bir: 'a whistle' }), o('puppet', 'puppet', 'kukla', '#8E7CF0', { bir: 'a puppet' })]);
  ekle('clothes', [o('skirt', 'skirt', 'etek', '#8E7CF0', { yer: 'bacak', hava: 'sunny', durum: 'It\'s a nice day!' }), o('shorts', 'shorts', 'şort', '#FF7A1A', { yer: 'bacak', hava: 'hot', durum: 'It\'s very hot!', cok: 1 }),
    o('jacket', 'jacket', 'ceket', '#2E7DD8', { yer: 'govde', hava: 'windy', durum: 'It\'s a bit cold!' }), o('sweater', 'sweater', 'kazak', '#E5484D', { yer: 'govde', hava: 'cold', durum: 'It\'s chilly!' }),
    o('pyjamas', 'pyjamas', 'pijama', '#6E7FE0', { yer: 'govde', hava: 'sleep', durum: 'It\'s bedtime!', cok: 1 }), o('cap', 'cap', 'kasket', '#E5484D', { yer: 'bas', hava: 'sun', durum: 'The sun is bright!' }),
    o('sunglasses', 'sunglasses', 'güneş gözlüğü', '#23304D', { yer: 'goz', hava: 'sunny', durum: 'It\'s so sunny!', cok: 1 }), o('belt', 'belt', 'kemer', '#8F5A3A', { yer: 'bel', hava: 'trousers', durum: 'Your trousers are too big!' }),
    o('sandals', 'sandals', 'sandalet', '#C98A4B', { yer: 'ayak', hava: 'summer', durum: 'Let\'s go to the beach!', cok: 1 }), o('swimsuit', 'swimsuit', 'mayo', '#1FA597', { yer: 'govde', hava: 'swim', durum: 'Let\'s go swimming!' })]);
  ekle('home', [o('tv', 'TV', 'televizyon', '#5B6478', { oda: ['living'] }), o('mirror', 'mirror', 'ayna', '#3BAED8', { oda: ['bathroom', 'bedroom'] }), o('shower', 'shower', 'duş', '#2E8FE8', { oda: ['bathroom'] }),
    o('sink', 'sink', 'lavabo', '#7C8AA3', { oda: ['bathroom', 'kitchen'] }), o('cooker', 'cooker', 'ocak', '#E5484D', { oda: ['kitchen'] }), o('wardrobe', 'wardrobe', 'gardırop', '#B07A40', { oda: ['bedroom'] }),
    o('carpet', 'carpet', 'halı', '#E5484D', { oda: ['living', 'bedroom'] }), o('stairs', 'stairs', 'merdiven', '#C98A4B', { cok: 1 }), o('plant', 'plant', 'saksı çiçeği', '#3FB86A', { oda: ['living'] }), o('pillow', 'pillow', 'yastık', '#6E7FE0', { oda: ['bedroom'] })]);
  ekle('school', [o('notebook', 'notebook', 'defter', '#3FB86A'), o('pen', 'pen', 'tükenmez kalem', '#2E7DD8'), o('sharpener', 'sharpener', 'kalemtıraş', '#E5484D'), o('chalk', 'chalk', 'tebeşir', '#7C8AA3'),
    o('paints', 'paints', 'boyalar', '#E8A400', { cok: 1 }), o('globe', 'globe', 'küre', '#2E8FE8'), o('computer', 'computer', 'bilgisayar', '#5B6478'), o('lunchbox', 'lunchbox', 'beslenme çantası', '#E8B820'),
    o('stapler', 'stapler', 'zımba', '#E5484D'), o('paper', 'paper', 'kâğıt', '#7C8AA3')]);
  ekle('weather', [o('sun', 'sun', 'güneş', '#E8A400', { isim: 1, izle: 'Look at the sun!' }), o('cloud', 'cloud', 'bulut', '#7C8AA3', { isim: 1, izle: 'Look, a cloud!' }), o('rain', 'rain', 'yağmur', '#2E8FE8', { isim: 1, izle: 'Here comes the rain!' }),
    o('snow', 'snow', 'kar', '#3BAED8', { isim: 1, izle: 'Look, snow!' }), o('wind', 'wind', 'rüzgâr', '#1FA597', { isim: 1, izle: 'Feel the wind!' }), o('umbrella', 'umbrella', 'şemsiye', '#E5484D', { isim: 1, izle: 'I have an umbrella!' }),
    o('snowman', 'snowman', 'kardan adam', '#3BAED8', { isim: 1, izle: 'Look, a snowman!' }), o('puddle', 'puddle', 'su birikintisi', '#2E8FE8', { isim: 1, izle: 'Jump in the puddle!' }),
    o('lightning', 'lightning', 'şimşek', '#E8A400', { isim: 1, izle: 'Look, lightning!' }), o('ice', 'ice', 'buz', '#3BAED8', { isim: 1, izle: 'Brr! Ice!' })]);
  ekle('feelings', [o('proud', 'proud', 'gururlu', '#E8A400', { durum: 'I won a prize!', resim: 'star' }), o('worried', 'worried', 'endişeli', '#7C8AA3', { durum: 'Where is my cat?', resim: 'cat' }),
    o('silly', 'silly', 'şakacı', '#FF7A1A', { durum: 'Look at my funny face!', resim: 'puppet' }), o('brave', 'brave', 'cesur', '#E5484D', { durum: 'I climbed so high!', resim: 'climb' }),
    o('loved', 'loved', 'sevilmiş', '#FF6FA5', { durum: 'Mum gives me a big hug.', resim: 'mum' }), o('calm', 'calm', 'sakin', '#3FB86A', { durum: 'I\'m reading a quiet book.', resim: 'read' }),
    o('nervous', 'nervous', 'gergin', '#8E7CF0', { durum: 'My first day at school!', resim: 'bag' }), o('sick', 'sick', 'hasta', '#3FB86A', { durum: 'I have a cold. I need soup.', resim: 'soup' }),
    o('thirsty', 'thirsty', 'susamış', '#2E8FE8', { durum: 'It\'s so hot! I need water.', resim: 'sun' }), o('sleepy', 'sleepy', 'uykulu', '#6E7FE0', { durum: 'It\'s very late at night.', resim: 'sleep' })]);
  /* oyunların ikinci kata uyumu */
  var FIG = ['head', 'eyes', 'ears', 'nose', 'mouth', 'hands', 'hair', 'feet', 'arms', 'legs', 'neck', 'shoulders', 'knees', 'tummy'];
  K.al('body').oyun3.hedefler = function (l) { return l.filter(function (x) { return FIG.indexOf(x.id) > -1; }); };
  K.al('weather').oyun3.hedefler = function (l) { return l.filter(function (x) { return !x.isim; }); };
  K.al('school').oyun3.hedefler = function (l) { return l.filter(function (x) { return ['bag', 'desk', 'board', 'computer', 'globe'].indexOf(x.id) < 0; }); };
  K.al('feelings').oyun3.yakin = { tired: 'sleepy', sleepy: 'tired' };   /* aynı turda ikisi birden seçenek olmaz */
  ['animals', 'food'].forEach(function (id) { K.al(id).karisik = 'say'; });
  ['toys', 'clothes', 'home', 'school'].forEach(function (id) { K.al(id).karisik = 'renk'; });

  /* ---------------- 2) ikinci takımada ---------------- */
  tema({
    id: 'fruits', ad: 'Fruits', giris: 'Let\'s eat some fruit!', dokun: 'Meyvelere dokun ve dinle.', hafiza: 'Find the same fruit!', balon: pop, karisik: 'say',
    izle: function (x) { return 'Look, ' + x.bir + '!'; },
    liste: [o('orangefruit', 'orange', 'portakal', '#FF8A00', { bir: 'an orange' }), o('grapes', 'grapes', 'üzüm', '#8E5AC8', { bir: 'grapes', cok: 1 }), o('pear', 'pear', 'armut', '#8CB528', { bir: 'a pear' }), o('lemon', 'lemon', 'limon', '#D9B400', { bir: 'a lemon' }),
      o('watermelon', 'watermelon', 'karpuz', '#3FB86A', { bir: 'a watermelon' }), o('cherries', 'cherries', 'kiraz', '#E5484D', { bir: 'cherries', cok: 1 }), o('pineapple', 'pineapple', 'ananas', '#E8A400', { bir: 'a pineapple' }), o('peach', 'peach', 'şeftali', '#FF8A6B', { bir: 'a peach', cogul: 'peaches' }),
      o('kiwi', 'kiwi', 'kivi', '#6FA82E', { bir: 'a kiwi' }), o('mango', 'mango', 'mango', '#E8A400', { bir: 'a mango' })],
    oyun3: { id: 'kase', ad: 'Salata', simge: 'cherries', motor: 'yerlestir', kap: 'kase', soz: function (x) { return 'Put the ' + x.en + ' in the bowl!'; }, dogru: function (x) { return x.en + '!'; }, son: 'What a yummy fruit salad!' },
    cikartma: ['watermelon', 'pineapple', 'cherries'],
    sarki: [{ kim: 'orangefruit', soz: 'Orange, orange, round and sweet!' }, { kim: 'grapes', soz: 'Purple grapes, one, two, three!' }, { kim: 'lemon', soz: 'Yellow lemon, sour, sour, sour!' },
      { kim: 'watermelon', soz: 'Big watermelon, red inside!' }, { kim: 'pineapple', soz: 'Pineapple, pineapple, spiky crown!' }, { kim: null, soz: 'Fruit, fruit, I love fruit!' }],
    ev: [['Do you like grapes?', 'Üzüm sever misin?'], ['A banana, please.', 'Bir muz lütfen.'], ['It\'s sweet!', 'Tatlı!']],
    etkinlik: [{ ad: 'Meyve tabağı', adim: 'Meyve keserken çocuğunuz sıradaki meyvenin adını söylesin: “Orange!”, “Pear!” Tabak dolunca birlikte sayın.' },
      { ad: 'Gözü kapalı tat', adim: 'Gözü kapalı bir meyve tattırın: “What is it?” — “It\'s a peach!”' }]
  });
  tema({
    id: 'transport', ad: 'Transport', giris: 'Let\'s go! Beep, beep!', dokun: 'Taşıtlara dokun ve dinle.', hafiza: 'Find the same vehicles!', balon: pop, karisik: 'renk',
    izle: function (x) { return 'It\'s a ' + kucuk(x) + '!'; },
    liste: [o('bus', 'bus', 'otobüs', '#E8A400', { ses: 'Beep, beep', cogul: 'buses' }), o('plane', 'plane', 'uçak', '#E5484D', { ses: 'Whoosh' }), o('ship', 'ship', 'gemi', '#2E7DD8', { ses: 'Toot, toot' }), o('bike', 'bike', 'bisiklet', '#3FB86A', { ses: 'Ring, ring' }),
      o('helicopter', 'helicopter', 'helikopter', '#2E8FE8', { ses: 'Chop, chop, chop' }), o('taxi', 'taxi', 'taksi', '#E8B820', { ses: 'Honk, honk' }), o('tractor', 'tractor', 'traktör', '#3FB86A', { ses: 'Putt, putt' }), o('truck', 'truck', 'kamyon', '#E5484D', { ses: 'Vroom, vroom' }),
      o('rocket', 'rocket', 'roket', '#FF7A1A', { ses: 'Three, two, one, blast off' }), o('motorbike', 'motorbike', 'motosiklet', '#E5484D', { ses: 'Brrm, brrm' })],
    oyun3: { id: 'tasit', ad: 'Kim geliyor?', simge: 'ses', motor: 'sec', hedefler: function (l) { return l.filter(function (x) { return x.ses; }); },
      soz: function (x) { return x.ses + '! What is it?'; }, dogru: function (x) { return 'It\'s a ' + kucuk(x) + '!'; }, son: 'You know all the vehicles!' },
    cikartma: ['rocket', 'helicopter', 'bus'],
    sarki: [{ kim: 'bus', soz: 'The bus goes beep, beep, beep!' }, { kim: 'plane', soz: 'The plane flies high, whoosh, whoosh!' }, { kim: 'ship', soz: 'The ship sails on the sea!' },
      { kim: 'bike', soz: 'Ride my bike, ring, ring, ring!' }, { kim: 'rocket', soz: 'Three, two, one, the rocket goes up!' }, { kim: null, soz: 'Let\'s go, let\'s go, here we go!' }],
    ev: [['How do you go to school?', 'Okula nasıl gidiyorsun?'], ['By bus!', 'Otobüsle!'], ['Look, a plane!', 'Bak, bir uçak!']],
    etkinlik: [{ ad: 'Pencere avı', adim: 'Pencereden ya da yolda gördüğünüz taşıtları sayın: “A bus! Two cars!”' }, { ad: 'Taşıt sesleri', adim: 'Bir taşıt sesi çıkarın (“Toot, toot!”), çocuğunuz adını söylesin: “Ship!”' }]
  });
  var SEKIL_N = { circle: [['ball', 'the ball'], ['clock', 'the clock']], square: [['window', 'the window'], ['dice', 'the dice']], triangle: [['pizza', 'the pizza']], rectangle: [['door', 'the door'], ['bus', 'the bus']],
    star: [['starfish', 'the starfish']], heart: [], oval: [['egg', 'the egg']], diamond: [['kite', 'the kite']] };
  tema({
    id: 'shapes', ad: 'Shapes', giris: 'Let\'s find shapes!', dokun: 'Şekillere dokun ve dinle.', hafiza: 'Find the same shapes!', balon: pop, karisik: 'renk',
    izle: function (x) { return 'It\'s ' + (x.id === 'oval' ? 'an ' : 'a ') + x.en + '!'; },
    liste: [o('circle', 'circle', 'daire', '#2E8FE8'), o('square', 'square', 'kare', '#E5484D'), o('triangle', 'triangle', 'üçgen', '#3FB86A'), o('star', 'star', 'yıldız', '#E8A400'),
      o('rectangle', 'rectangle', 'dikdörtgen', '#FF7A1A'), o('heart', 'heart', 'kalp', '#FF6FA5'), o('oval', 'oval', 'oval', '#8E7CF0'), o('diamond', 'diamond', 'baklava dilimi', '#1FA597')],
    oyun3: { id: 'sekil', ad: 'Ne şekil?', simge: 'triangle', motor: 'sec',
      tur: function (x) { var l = SEKIL_N[x.id] || []; if (!l.length) return null; var s = l[Math.floor(Math.random() * l.length)]; return { resim: s[0], soz: 'What shape is ' + s[1] + '?' }; },
      turlar: function (x) { return (SEKIL_N[x.id] || []).map(function (s) { return { resim: s[0], soz: 'What shape is ' + s[1] + '?' }; }); },
      soz: function (x) { return 'Find the ' + x.en + '!'; }, dogru: function (x) { return 'It\'s ' + (x.id === 'oval' ? 'an ' : 'a ') + x.en + '!'; }, son: 'You are a shape star!' },
    cikartma: ['star', 'heart', 'diamond'],
    sarki: [{ kim: 'circle', soz: 'A circle is round like the sun!' }, { kim: 'square', soz: 'A square has four sides, one, two, three, four!' }, { kim: 'triangle', soz: 'A triangle has three, one, two, three!' },
      { kim: 'star', soz: 'Twinkle, twinkle, little star shape!' }, { kim: 'heart', soz: 'A heart for you, a heart for me!' }, { kim: null, soz: 'Shapes, shapes, all around me!' }],
    ev: [['What shape is it?', 'Bu ne şekil?'], ['It\'s a circle!', 'Bu bir daire!'], ['Find a square!', 'Bir kare bul!']],
    etkinlik: [{ ad: 'Şekil avı', adim: 'Evde şekil arayın: “Find a circle!” Saat, tabak, pencere… Bulunca adını söylesin.' }, { ad: 'Kâğıt şekiller', adim: 'Kâğıttan üçgen, kare, daire kesin; çocuğunuz sizin söylediğiniz şekli göstersin.' }]
  });
  tema({
    id: 'sea', ad: 'Under the sea', giris: 'Let\'s dive under the sea!', dokun: 'Deniz canlılarına dokun ve dinle.', hafiza: 'Find the same sea animals!', balon: pop, karisik: 'say',
    izle: function (x) { return 'It\'s a ' + x.en + '!'; },
    liste: [o('whale', 'whale', 'balina', '#2E6FD8'), o('dolphin', 'dolphin', 'yunus', '#3B8FD8'), o('octopus', 'octopus', 'ahtapot', '#F0559A', { bir: 'an', cogul: 'octopuses' }), o('crab', 'crab', 'yengeç', '#E5484D'),
      o('turtle', 'turtle', 'kaplumbağa', '#3FB86A'), o('starfish', 'starfish', 'deniz yıldızı', '#FF7A1A', { cogul: 'starfish' }), o('shark', 'shark', 'köpek balığı', '#5B6478'), o('jellyfish', 'jellyfish', 'denizanası', '#A97CD8', { cogul: 'jellyfish' }),
      o('seahorse', 'seahorse', 'denizatı', '#E8A400'), o('shell', 'shell', 'deniz kabuğu', '#F06A95')],
    oyun3: { id: 'akvaryum', ad: 'Akvaryum', simge: 'whale', motor: 'yerlestir', kap: 'akvaryum', soz: function (x) { return 'Put the ' + x.en + ' in the water!'; }, dogru: function (x) { return x.en + '!'; }, son: 'Splash! The sea is full of friends!' },
    cikartma: ['whale', 'octopus', 'starfish'],
    sarki: [{ kim: 'whale', soz: 'A big blue whale says hello!' }, { kim: 'dolphin', soz: 'Dolphins jump, splash, splash, splash!' }, { kim: 'octopus', soz: 'Octopus has eight long arms!' },
      { kim: 'crab', soz: 'A little crab walks side to side!' }, { kim: 'turtle', soz: 'Slow, slow turtle swims along!' }, { kim: null, soz: 'Under the sea, swim with me!' }],
    ev: [['Can you swim like a fish?', 'Balık gibi yüzebilir misin?'], ['Look, a crab!', 'Bak, bir yengeç!'], ['The sea is blue.', 'Deniz mavi.']],
    etkinlik: [{ ad: 'Deniz hareketleri', adim: '“Crab!” deyince yan yan yürüyün, “Dolphin!” deyince zıplayın, “Turtle!” deyince yavaşça yürüyün.' }, { ad: 'Banyo denizi', adim: 'Banyoda oyuncaklarla deniz kurun; her oyuncağı suya koyarken adını söyleyin.' }]
  });
  var AN = function (x) { return /^[aeiou]/i.test(x.en) ? 'an ' : 'a '; };
  tema({
    id: 'jobs', ad: 'Jobs', giris: 'What do you want to be?', dokun: 'Mesleklere dokun ve dinle.', hafiza: 'Find the same jobs!', balon: pop,
    izle: function (x) { return 'I\'m ' + AN(x) + x.en + '!'; },
    liste: [o('doctor', 'doctor', 'doktor', '#2E8FE8', { arac: 'stetoskop', kim: 'Who helps sick people?' }), o('teacher', 'teacher', 'öğretmen', '#8E7CF0', { arac: 'board', kim: 'Who teaches children?' }),
      o('chef', 'chef', 'aşçı', '#E5484D', { arac: 'tencere', kim: 'Who cooks food?' }), o('firefighter', 'firefighter', 'itfaiyeci', '#E5484D', { arac: 'yangin', kim: 'Who puts out fires?' }),
      o('police', 'police officer', 'polis', '#2E4A8C', { arac: 'polisrozet', kim: 'Who keeps us safe?' }), o('farmer', 'farmer', 'çiftçi', '#3FB86A', { arac: 'tractor', kim: 'Who drives a tractor?' }),
      o('pilot', 'pilot', 'pilot', '#2E4A8C', { arac: 'plane', kim: 'Who flies a plane?' }), o('builder', 'builder', 'inşaat işçisi', '#FF7A1A', { arac: 'cekic', kim: 'Who builds houses?' }),
      o('nurse', 'nurse', 'hemşire', '#1FA597', { arac: 'yarabandi', kim: 'Who looks after patients?' }), o('vet', 'vet', 'veteriner', '#3FB86A', { arac: 'dog', kim: 'Who helps animals?' })],
    oyun3: { id: 'meslek', ad: 'Kim yapar?', simge: 'doctor', motor: 'sec', tur: function (x) { return { resim: x.arac, soz: x.kim }; }, turlar: function (x) { return [{ resim: x.arac, soz: x.kim }]; },
      soz: function (x) { return x.kim; }, dogru: function (x) { return AN(x).charAt(0).toUpperCase() + AN(x).slice(1) + x.en + '!'; }, son: 'Great! You know all the jobs!' },
    cikartma: ['firefighter', 'pilot', 'chef'],
    sarki: [{ kim: 'doctor', soz: 'The doctor helps me when I\'m sick!' }, { kim: 'teacher', soz: 'My teacher reads a book with me!' }, { kim: 'chef', soz: 'The chef cooks, yum, yum, yum!' },
      { kim: 'firefighter', soz: 'The firefighter is brave and strong!' }, { kim: 'farmer', soz: 'The farmer drives a big tractor!' }, { kim: null, soz: 'What do you want to be? You can be anything!' }],
    ev: [['What do you want to be?', 'Büyüyünce ne olmak istersin?'], ['I want to be a doctor.', 'Doktor olmak istiyorum.'], ['Thank you, chef!', 'Teşekkürler aşçı!']],
    etkinlik: [{ ad: 'Meslek tiyatrosu', adim: 'Sırayla bir mesleği canlandırın; diğeri bilsin: “You\'re a chef!” Şapka, kaşık gibi eşyalar işi kolaylaştırır.' }, { ad: 'Kim yardım eder?', adim: 'Sokakta gördüğünüz meslekleri birlikte söyleyin: “Look, a police officer!”' }]
  });
  tema({
    id: 'actions', ad: 'Actions', giris: 'Let\'s move! Stand up!', dokun: 'Hareketlere dokun ve dinle.', hafiza: 'Find the same actions!',
    balon: function (x) { return 'Who can ' + x.en + '? Pop!'; },
    izle: function (x) { return 'I can ' + x.en + '!'; },
    liste: [o('run', 'run', 'koşmak', '#E5484D'), o('jump', 'jump', 'zıplamak', '#FF7A1A'), o('swim', 'swim', 'yüzmek', '#2E8FE8'), o('sing', 'sing', 'şarkı söylemek', '#8E7CF0'), o('dance', 'dance', 'dans etmek', '#FF6FA5'),
      o('sleep', 'sleep', 'uyumak', '#6E7FE0'), o('eat', 'eat', 'yemek', '#3FB86A'), o('read', 'read', 'okumak', '#1FA597'), o('draw', 'draw', 'resim yapmak', '#E8A400'), o('climb', 'climb', 'tırmanmak', '#B07A40')],
    oyun3: { id: 'hareket', ad: 'Yapabilir', simge: 'jump', motor: 'sec', soz: function (x) { return 'Who can ' + x.en + '?'; }, dogru: function (x) { return 'I can ' + x.en + '!'; }, son: 'Wow! You can do so much!' },
    cikartma: ['dance', 'swim', 'climb'],
    sarki: [{ kim: 'run', soz: 'Run, run, run on the spot!' }, { kim: 'jump', soz: 'Jump, jump, jump up high!' }, { kim: 'swim', soz: 'Swim, swim, like a fish!' },
      { kim: 'dance', soz: 'Dance, dance, turn around!' }, { kim: 'sleep', soz: 'Now we sleep, shh, shh, shh!' }, { kim: null, soz: 'I can move, I can move, look at me!' }],
    ev: [['Can you jump?', 'Zıplayabilir misin?'], ['Yes, I can!', 'Evet, yapabilirim!'], ['Let\'s dance!', 'Hadi dans edelim!']],
    etkinlik: [{ ad: 'Dur-kalk oyunu', adim: 'Müzik açın; durdurunca bir hareket söyleyin: “Jump!”, “Dance!” Çocuğunuz yapsın.' }, { ad: 'Hareket zarı', adim: 'Kâğıda altı hareket çizip zar atın; çıkanı birlikte yapıp söyleyin: “I can run!”' }]
  });
  var MEVSIM = { spring: [['cicek', 'flowers'], ['rainbow', 'a rainbow']], summer: [['icecream', 'ice cream'], ['sunny', 'the hot sun']], autumn: [['yaprak', 'orange leaves'], ['umbrella', 'an umbrella']], winter: [['snowman', 'a snowman'], ['scarf', 'a scarf']] };
  tema({
    id: 'seasons', ad: 'Seasons', giris: 'Spring, summer, autumn, winter!', dokun: 'Mevsimlere dokun ve dinle.', hafiza: 'Find the same seasons!', balon: pop,
    izle: function (x) { return 'It\'s ' + x.en + '!'; },
    liste: [o('spring', 'spring', 'ilkbahar', '#3FB86A'), o('summer', 'summer', 'yaz', '#E8A400'), o('autumn', 'autumn', 'sonbahar', '#FF7A1A'), o('winter', 'winter', 'kış', '#2E8FE8')],
    oyun3: { id: 'mevsim', ad: 'Ne zaman?', simge: 'spring', motor: 'sec',
      tur: function (x) { var s = MEVSIM[x.id][Math.floor(Math.random() * 2)]; return { resim: s[0], soz: 'When do we see ' + s[1] + '?' }; },
      turlar: function (x) { return MEVSIM[x.id].map(function (s) { return { resim: s[0], soz: 'When do we see ' + s[1] + '?' }; }); },
      soz: function (x) { return 'Find ' + x.en + '!'; }, dogru: function (x) { return 'In ' + x.en + '!'; }, son: 'You know all four seasons!' },
    cikartma: ['spring', 'summer', 'winter'],
    sarki: [{ kim: 'spring', soz: 'In spring the flowers grow!' }, { kim: 'summer', soz: 'In summer we play in the sun!' }, { kim: 'autumn', soz: 'In autumn the leaves fall down!' },
      { kim: 'winter', soz: 'In winter we play in the snow!' }, { kim: null, soz: 'Four seasons, round and round!' }],
    ev: [['What season is it?', 'Hangi mevsimdeyiz?'], ['It\'s winter!', 'Kış!'], ['I like summer.', 'Yazı severim.']],
    etkinlik: [{ ad: 'Mevsim dolabı', adim: 'Dolaptan bir giysi çıkarın: “When do we wear it?” — “In winter!”' }, { ad: 'Pencere mevsimi', adim: 'Her hafta pencereden bakıp mevsimi söyleyin; yaprak, kar, çiçek gibi ipuçlarını gösterin.' }]
  });
  var GUNLER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], BUYUK = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
  tema({
    id: 'days', ad: 'Days', giris: 'Seven days in a week!', dokun: 'Günlere dokun ve dinle.', hafiza: 'Find the same days!',
    balon: function (x) { return 'Pop ' + x.en + '!'; },
    izle: function (x) { return 'Today is ' + x.en + '!'; },
    liste: GUNLER.map(function (g, i) { return o(g, BUYUK(g), ['pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi', 'pazar'][i], ['#2E8FE8', '#3FB86A', '#E8A400', '#FF7A1A', '#8E7CF0', '#FF6FA5', '#E5484D'][i]); }),
    say: { minik: 7, kasif: 7, yildiz: 7 },
    oyun3: { id: 'gunsira', ad: 'Sıradaki', simge: 'friday', motor: 'sec',
      tur: function (x) { var i = GUNLER.indexOf(x.id), once = GUNLER[(i + 6) % 7]; return { resim: once, soz: 'What comes after ' + BUYUK(once) + '?' }; },
      turlar: function (x) { var i = GUNLER.indexOf(x.id), once = GUNLER[(i + 6) % 7]; return [{ resim: once, soz: 'What comes after ' + BUYUK(once) + '?' }]; },
      soz: function (x) { return 'Find ' + x.en + '!'; }, dogru: function (x) { return x.en + '!'; }, son: 'Seven days, well done!' },
    cikartma: ['friday', 'saturday', 'sunday'],
    sarki: [{ kim: 'monday', soz: 'Monday, Tuesday, back to school!' }, { kim: 'wednesday', soz: 'Wednesday, Thursday, learn and play!' }, { kim: 'friday', soz: 'Friday, Friday, almost there!' },
      { kim: 'saturday', soz: 'Saturday, Sunday, fun all day!' }, { kim: null, soz: 'Seven days, seven days in a week!' }],
    ev: [['What day is it today?', 'Bugün günlerden ne?'], ['It\'s Monday.', 'Pazartesi.'], ['See you on Friday!', 'Cuma görüşürüz!']],
    etkinlik: [{ ad: 'Sabah takvimi', adim: 'Her sabah sorun: “What day is it today?” Çocuğunuz takvimde günü göstersin ve söylesin.' }, { ad: 'Hafta zinciri', adim: 'Yedi kâğıda gün adlarını yazın; karıştırıp birlikte sıraya dizin, dizerken söyleyin.' }]
  });
  tema({
    id: 'places', ad: 'Where is it?', giris: 'Where is the ball?', dokun: 'Resimlere dokun ve dinle.', hafiza: 'Find the same pictures!',
    balon: function (x) { return x.cumle; },
    izle: function (x) { return x.cumle; },
    liste: [o('in', 'in', 'içinde', '#B07A40', { cumle: 'The ball is in the box.' }), o('on', 'on', 'üstünde', '#E5484D', { cumle: 'The ball is on the box.' }), o('under', 'under', 'altında', '#2E8FE8', { cumle: 'The ball is under the table.' }),
      o('next', 'next to', 'yanında', '#3FB86A', { cumle: 'The ball is next to the box.' }), o('behind', 'behind', 'arkasında', '#8E7CF0', { cumle: 'The ball is behind the box.' }), o('front', 'in front of', 'önünde', '#FF7A1A', { cumle: 'The ball is in front of the box.' })],
    say: { minik: 3, kasif: 6, yildiz: 6 },
    oyun3: { id: 'nerede', ad: 'Nerede?', simge: 'under', motor: 'sec', soz: function (x) { return x.cumle + ' Find it!'; }, dogru: function (x) { return x.cumle; }, son: 'You found the ball every time!' },
    cikartma: ['in', 'under', 'behind'],
    sarki: [{ kim: 'in', soz: 'In the box, in the box, where is the ball?' }, { kim: 'on', soz: 'On the box, on the box, here it is!' }, { kim: 'under', soz: 'Under the table, hiding there!' },
      { kim: 'behind', soz: 'Behind the box, peek-a-boo!' }, { kim: null, soz: 'Where is it? Where is it? Can you see?' }],
    ev: [['Where is your shoe?', 'Ayakkabın nerede?'], ['It\'s under the bed.', 'Yatağın altında.'], ['Put it on the table.', 'Masanın üstüne koy.']],
    etkinlik: [{ ad: 'Saklambaç oyuncak', adim: 'Bir oyuncağı saklayın, ipucu verin: “It\'s under the chair!” Bulunca rolleri değiştirin.' }, { ad: 'Komut oyunu', adim: '“Put the spoon in the cup!”, “Put the teddy on the bed!” deyin; çocuğunuz yapsın.' }]
  });
  var HARF = W.KIDS_RESIM.HARF, HARF_AD = { icecream: 'ice cream' };
  var HARF_R = ['#E5484D', '#FF7A1A', '#D9A400', '#3FB86A', '#2E8FE8', '#8E7CF0', '#FF6FA5'];
  tema({
    id: 'alphabet', ad: 'ABC', giris: 'Let\'s sing the ABC!', dokun: 'Harflere dokun ve dinle.', hafiza: 'Find the same letters!',
    balon: function (x) { return 'Pop the letter ' + x.en + '!'; },
    izle: function (x) { return x.en + ' is for ' + x.kelime + '!'; },
    liste: Object.keys(HARF).map(function (h, i) { var k = HARF_AD[HARF[h]] || HARF[h]; return o('harf-' + h, h.toUpperCase(), h.toUpperCase() + ' harfi · ' + k, HARF_R[i % 7], { kelime: k, resim: HARF[h] }); }),
    say: { minik: 6, kasif: 13, yildiz: 26 },
    oyun3: { id: 'harf', ad: 'Hangi harf?', simge: 'harf-a', motor: 'sec',
      tur: function (x) { return { resim: x.resim, soz: BUYUK(x.kelime) + '! What letter is it?' }; }, turlar: function (x) { return [{ resim: x.resim, soz: BUYUK(x.kelime) + '! What letter is it?' }]; },
      soz: function (x) { return 'Find the letter ' + x.en + '!'; }, dogru: function (x) { return x.en + ' is for ' + x.kelime + '!'; }, son: 'Now you know your ABC!' },
    cikartma: ['harf-a', 'harf-b', 'harf-c'],
    sarki: [{ kim: 'harf-a', soz: 'A, B, C, D, E, F, G!' }, { kim: 'harf-h', soz: 'H, I, J, K, L, M, N, O, P!' }, { kim: 'harf-q', soz: 'Q, R, S, T, U, V!' }, { kim: 'harf-w', soz: 'W, X, Y and Z!' },
      { kim: null, soz: 'Now I know my ABC, sing it again with me!' }],
    ev: [['What letter is it?', 'Bu hangi harf?'], ['A is for apple.', 'A, apple (elma) gibi.'], ['Can you find B?', 'B harfini bulabilir misin?']],
    etkinlik: [{ ad: 'Harf avı', adim: 'Kutuların, kitapların üstünde bir harf arayın: “Find A!” Bulunca o harfle başlayan bir İngilizce kelime söyleyin.' }, { ad: 'Parmakla yaz', adim: 'Unun ya da kumun üstüne parmakla bir harf yazın; çocuğunuz adını söylesin.' }]
  });

  /* ---------------- 3) karışık durak: sayı × renk × kelime ---------------- */
  /* çoğul: food'un cok alanı çoğul kelimedir; başka konularda cok:1 "kelime zaten çoğul" demektir */
  function cogul(x) { return typeof x.cok === 'string' ? x.cok : x.cogul || (/(s|sh|ch|x)$/.test(x.en) ? x.en + 'es' : /[^aeiou]y$/.test(x.en) ? x.en.slice(0, -1) + 'ies' : x.en + 's'); }
  function karisikUygun(x) { return x.cok !== 1 && !x.tek; }
  W.KIDS_TEMALAR.cogul = cogul;
  W.KIDS_TEMALAR.karisikUygun = karisikUygun;
})(window);
