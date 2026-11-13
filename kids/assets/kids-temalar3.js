/* ==========================================================================
   ACADEX KIDS · üçüncü kat kelimeler (kids/assets/kids-temalar3.js), 13.11.2026
   22 konunun her birine yeni kelimeler (toplam ~190). Kelimeler paketlere bölünür
   (KIDS_KONU.paketle): Minikler 6'lık, Kâşifler 8'lik, Yıldızlar 10'luk paketlerle
   bütün kelimelere ulaşır. Konuya özel oyunların ihtiyaç duyduğu alanlar (ses, durum,
   oda, giysi yeri, meslek sorusu…) burada her kelimeyle birlikte verilir.
   ========================================================================== */
(function (W) {
  'use strict';
  var T = W.KIDS_TEMALAR, K = W.KIDS_KONU, o = T.o;
  function ekle(id, l) { var p = K.al(id); l.forEach(function (x) { p.liste.push(x); }); return p; }
  var AN = function (s) { return /^[aeiou]/i.test(s) ? 'an ' : 'a '; };

  ekle('animals', [o('penguin', 'penguin', 'penguen', '#23304D'), o('owl', 'owl', 'baykuş', '#B07A40', { ses: 'Hoot', izle: 'It\'s an owl!' }), o('bee', 'bee', 'arı', '#E8A400', { ses: 'Buzz' }),
    o('butterfly', 'butterfly', 'kelebek', '#FF6FA5'), o('zebra', 'zebra', 'zebra', '#5B6478'), o('panda', 'panda', 'panda', '#23304D'), o('fox', 'fox', 'tilki', '#F0703A'),
    o('goat', 'goat', 'keçi', '#9AA7BD', { ses: 'Maa' }), o('hen', 'hen', 'tavuk', '#E5484D', { ses: 'Cluck' }), o('crocodile', 'crocodile', 'timsah', '#3FB86A', { ses: 'Snap' }),
    o('hippo', 'hippo', 'su aygırı', '#8E7CF0'), o('squirrel', 'squirrel', 'sincap', '#D9893A')]);
  ekle('family', [o('me', 'me', 'ben', '#E8A400'), o('son', 'son', 'oğul', '#2E8FE8', { the: 1 }), o('daughter', 'daughter', 'kız evlat', '#FF8A3D', { the: 1 }),
    o('children', 'children', 'çocuklar', '#3FB86A', { the: 1, cok: 1 }), o('people', 'people', 'insanlar', '#8E7CF0', { the: 1, cok: 1 }), o('neighbour', 'neighbour', 'komşu', '#1FA597', { the: 1 })]);
  ekle('body', [o('chin', 'chin', 'çene', '#E8875A'), o('eyebrows', 'eyebrows', 'kaşlar', '#8F5A3A', { cok: 1 }), o('lips', 'lips', 'dudaklar', '#F0607A', { cok: 1 }),
    o('thumb', 'thumb', 'başparmak', '#E8B820'), o('nails', 'nails', 'tırnaklar', '#FF6FA5', { cok: 1 }), o('elbow', 'elbow', 'dirsek', '#3FB86A'), o('back', 'back', 'sırt', '#2E8FE8')]);
  ekle('food', [o('burger', 'burger', 'hamburger', '#C98A4B', { bir: 'a burger', cok: 'burgers' }), o('chips', 'chips', 'patates kızartması', '#E8A400', { bir: 'chips', cok: 'chips' }),
    o('salad', 'salad', 'salata', '#3FB86A', { bir: 'salad', cok: 'salad', tek: 1 }), o('tomato', 'tomato', 'domates', '#E5484D', { bir: 'a tomato', cok: 'tomatoes' }),
    o('potato', 'potato', 'patates', '#C98A4B', { bir: 'a potato', cok: 'potatoes' }), o('corn', 'corn', 'mısır', '#E8B820', { bir: 'corn', cok: 'corn', tek: 1 }),
    o('pancake', 'pancake', 'krep', '#E8A85A', { bir: 'a pancake', cok: 'pancakes' }), o('yoghurt', 'yoghurt', 'yoğurt', '#FF6FA5', { bir: 'yoghurt', cok: 'yoghurt', tek: 1 }),
    o('popcorn', 'popcorn', 'patlamış mısır', '#E5484D', { bir: 'popcorn', cok: 'popcorn', tek: 1 }), o('sweets', 'sweets', 'şekerler', '#FF6FA5', { bir: 'sweets', cok: 'sweets' }),
    o('lollipop', 'lollipop', 'lolipop', '#FF3F86', { bir: 'a lollipop', cok: 'lollipops' }), o('sausage', 'sausage', 'sosis', '#C9612A', { bir: 'a sausage', cok: 'sausages' })]);
  ekle('toys', [o('spintop', 'spinning top', 'topaç', '#E5484D', { bir: 'a spinning top' }), o('swing', 'swing', 'salıncak', '#C98A4B', { bir: 'a swing' }), o('slide', 'slide', 'kaydırak', '#E8B820', { bir: 'a slide' }),
    o('bucket', 'bucket', 'kova', '#2E8FE8', { bir: 'a bucket' }), o('rockinghorse', 'rocking horse', 'sallanan at', '#FF7A1A', { bir: 'a rocking horse' }), o('toyboat', 'boat', 'oyuncak tekne', '#E5484D', { bir: 'a boat' }),
    o('xylophone', 'xylophone', 'ksilofon', '#8E7CF0', { bir: 'a xylophone' }), o('guitar', 'guitar', 'gitar', '#FF7A1A', { bir: 'a guitar' }), o('trumpet', 'trumpet', 'trompet', '#E8A400', { bir: 'a trumpet' }),
    o('rope', 'jump rope', 'atlama ipi', '#E5484D', { bir: 'a jump rope' })]);
  ekle('clothes', [o('shirt', 'shirt', 'gömlek', '#2E8FE8', { yer: 'govde', hava: 'bag', durum: 'It\'s a school day!' }), o('jeans', 'jeans', 'kot pantolon', '#3B6FB6', { yer: 'bacak', hava: 'cloudy', durum: 'It\'s a cool day!', cok: 1 }),
    o('raincoat', 'raincoat', 'yağmurluk', '#E8A400', { yer: 'govde', hava: 'rainy', durum: 'It\'s raining!' }), o('slippers', 'slippers', 'terlik', '#FF6FA5', { yer: 'ayak', hava: 'sofa', durum: 'We\'re at home!', cok: 1 }),
    o('tie', 'tie', 'kravat', '#E5484D', { yer: 'boyun', hava: 'family', durum: 'It\'s a special day!' }), o('watch', 'watch', 'kol saati', '#8F5A3A', { yer: 'el', hava: 'clock', durum: 'What time is it?' }),
    o('necklace', 'necklace', 'kolye', '#8E7CF0', { yer: 'boyun', hava: 'balloon', durum: 'It\'s a party!' }), o('helmet', 'helmet', 'kask', '#E5484D', { yer: 'bas', hava: 'bike', durum: 'Let\'s ride a bike!' }),
    o('apron', 'apron', 'önlük', '#1FA597', { yer: 'govde', hava: 'cake', durum: 'Let\'s cook!' }), o('ribbon', 'ribbon', 'kurdele', '#FF3F86', { yer: 'bas', hava: 'hediye', durum: 'It\'s my birthday!' })]);
  ekle('home', [o('kitchen', 'kitchen', 'mutfak', '#FF8A3D'), o('bathroom', 'bathroom', 'banyo', '#2E8FE8'), o('bedroom', 'bedroom', 'yatak odası', '#8E7CF0'), o('livingroom', 'living room', 'oturma odası', '#3FB86A'),
    o('garden', 'garden', 'bahçe', '#3FB86A'), o('roof', 'roof', 'çatı', '#E5484D'), o('key', 'key', 'anahtar', '#E8A400'), o('phone', 'phone', 'telefon', '#5B6478', { oda: ['living', 'bedroom'] }),
    o('shelf', 'shelf', 'raf', '#C98A4B', { oda: ['living', 'bedroom'], cogul: 'shelves' }), o('curtains', 'curtains', 'perde', '#8E7CF0', { oda: ['bedroom', 'living'], cok: 1 })]);
  ekle('school', [o('pencilcase', 'pencil case', 'kalem kutusu', '#8E7CF0'), o('marker', 'marker', 'keçeli kalem', '#3FB86A'), o('map', 'map', 'harita', '#E8A400'), o('calculator', 'calculator', 'hesap makinesi', '#5B6478'),
    o('bell', 'bell', 'zil', '#E8B820'), o('playground', 'playground', 'oyun bahçesi', '#3FB86A'), o('classroom', 'classroom', 'sınıf', '#2E8FE8'), o('tape', 'tape', 'bant', '#E8A400', { tek: 1 }),
    o('sticker', 'sticker', 'çıkartma', '#FF6FA5'), o('magnifier', 'magnifying glass', 'büyüteç', '#8F5A3A', { cogul: 'magnifying glasses' })]);
  ekle('weather', [o('thunder', 'thunder', 'gök gürültüsü', '#5B6478', { isim: 1, izle: 'Listen! Thunder!' }), o('moon', 'moon', 'ay', '#E8A400', { isim: 1, izle: 'Look at the moon!' }),
    o('nightsky', 'night sky', 'gece gökyüzü', '#2E3F6E', { isim: 1, izle: 'Look at the stars in the night sky!' }), o('sunrise', 'sunrise', 'gün doğumu', '#FF8A3D', { isim: 1, izle: 'Good morning! It\'s sunrise!' }),
    o('tornado', 'tornado', 'hortum', '#7C8AA3', { isim: 1, izle: 'Look, a tornado!' }), o('warm', 'warm', 'ılık', '#FF7A1A'), o('hail', 'hail', 'dolu', '#7FB7F2', { isim: 1, izle: 'Look, hail!' }), o('wet', 'wet', 'ıslak', '#2E8FE8')]);
  ekle('feelings', [o('lonely', 'lonely', 'yalnız', '#7C8AA3', { durum: 'Nobody wants to play with me.', resim: 'ball' }), o('confused', 'confused', 'kafası karışık', '#8E7CF0', { durum: 'Which way do I go?', resim: 'map' }),
    o('curious', 'curious', 'meraklı', '#3FB86A', { durum: 'What\'s in the box?', resim: 'hediye' }), o('grumpy', 'grumpy', 'huysuz', '#E5484D', { durum: 'I don\'t want to wake up!', resim: 'clock' }),
    o('embarrassed', 'embarrassed', 'mahcup', '#FF6FA5', { durum: 'Oops! I fell in the puddle.', resim: 'puddle' }), o('hurt', 'hurt', 'canı yanmış', '#FF8A3D', { durum: 'Ouch! I fell off my bike.', resim: 'bike' })]);
  var fy = K.al('feelings').oyun3.yakin; fy.lonely = 'sad'; fy.sad = 'lonely'; fy.grumpy = 'angry'; fy.angry = 'grumpy'; fy.hurt = 'sad';
  ekle('fruits', [o('plum', 'plum', 'erik', '#8E5AC8', { bir: 'a plum' }), o('apricot', 'apricot', 'kayısı', '#FF9A3D', { bir: 'an apricot' }), o('fig', 'fig', 'incir', '#8E5AC8', { bir: 'a fig' }),
    o('melon', 'melon', 'kavun', '#C9B830', { bir: 'a melon' }), o('raspberry', 'raspberry', 'ahududu', '#E5304D', { bir: 'a raspberry' }), o('blueberries', 'blueberries', 'yaban mersini', '#3D5FC0', { bir: 'blueberries', cok: 1 }),
    o('coconut', 'coconut', 'hindistan cevizi', '#8F5A3A', { bir: 'a coconut' }), o('avocado', 'avocado', 'avokado', '#3F8A3A', { bir: 'an avocado' }), o('pomegranate', 'pomegranate', 'nar', '#D23A4A', { bir: 'a pomegranate' }),
    o('lime', 'lime', 'misket limonu', '#6FA82E', { bir: 'a lime' }), o('tangerine', 'tangerine', 'mandalina', '#FF8A00', { bir: 'a tangerine' }), o('quince', 'quince', 'ayva', '#D9B400', { bir: 'a quince' })]);
  ekle('transport', [o('ambulance', 'ambulance', 'ambulans', '#E5484D', { ses: 'Nee-naw, nee-naw' }), o('fireengine', 'fire engine', 'itfaiye aracı', '#E5484D'), o('policecar', 'police car', 'polis arabası', '#2E4A8C', { ses: 'Wee-woo, wee-woo' }),
    o('scooter', 'scooter', 'scooter', '#2E8FE8'), o('submarine', 'submarine', 'denizaltı', '#E8A400', { ses: 'Blub, blub' }), o('hotairballoon', 'hot-air balloon', 'sıcak hava balonu', '#E5484D'),
    o('tram', 'tram', 'tramvay', '#FF7A1A', { ses: 'Clang, clang' }), o('van', 'van', 'minibüs', '#2E8FE8'), o('sailboat', 'sailboat', 'yelkenli', '#2E8FE8'), o('canoe', 'canoe', 'kano', '#E5484D', { ses: 'Splash, splash' }),
    o('jeep', 'jeep', 'cip', '#3FB86A'), o('digger', 'digger', 'kepçe', '#E8A400', { ses: 'Dig, dig, dig' })]);
  ekle('shapes', [o('hexagon', 'hexagon', 'altıgen', '#E8A400'), o('pentagon', 'pentagon', 'beşgen', '#3FB86A'), o('semicircle', 'semicircle', 'yarım daire', '#FF6FA5'), o('crescent', 'crescent', 'hilal', '#8E7CF0'),
    o('cube', 'cube', 'küp', '#2E8FE8'), o('cone', 'cone', 'koni', '#FF7A1A'), o('cylinder', 'cylinder', 'silindir', '#1FA597'), o('arrow', 'arrow', 'ok', '#E5484D')]);
  ekle('sea', [o('seal', 'seal', 'fok', '#7C8AA3'), o('squid', 'squid', 'kalamar', '#F06A95', { cogul: 'squid' }), o('lobster', 'lobster', 'ıstakoz', '#E5484D'), o('coral', 'coral', 'mercan', '#FF7A80', { tek: 1 }),
    o('seaweed', 'seaweed', 'deniz yosunu', '#3FB86A', { tek: 1 }), o('stingray', 'stingray', 'vatoz', '#7C8AA3'), o('swordfish', 'swordfish', 'kılıç balığı', '#4A7FD8', { cogul: 'swordfish' }),
    o('clownfish', 'clownfish', 'palyaço balığı', '#FF7A1A', { cogul: 'clownfish' }), o('pufferfish', 'pufferfish', 'balon balığı', '#E8A400', { cogul: 'pufferfish' }), o('eel', 'eel', 'yılan balığı', '#3FB86A'),
    o('walrus', 'walrus', 'mors', '#B07A40'), o('anchor', 'anchor', 'çapa', '#7C8AA3')]);
  ekle('jobs', [o('dentist', 'dentist', 'diş hekimi', '#1FA597', { arac: 'teeth', kim: 'Who looks after our teeth?' }), o('artist', 'artist', 'ressam', '#8E7CF0', { arac: 'paints', kim: 'Who paints pictures?' }),
    o('singer', 'singer', 'şarkıcı', '#FF6FA5', { arac: 'nota', kim: 'Who sings songs?' }), o('postman', 'postman', 'postacı', '#E5484D', { arac: 'paper', kim: 'Who brings our letters?' }),
    o('mechanic', 'mechanic', 'tamirci', '#2E7DD8', { arac: 'car', kim: 'Who fixes cars?' }), o('scientist', 'scientist', 'bilim insanı', '#3FB86A', { arac: 'magnifier', kim: 'Who does experiments?' }),
    o('astronaut', 'astronaut', 'astronot', '#2E3F6E', { arac: 'rocket', kim: 'Who goes into space?' }), o('waiter', 'waiter', 'garson', '#23304D', { arac: 'pizza', kim: 'Who brings our food?' }),
    o('baker', 'baker', 'fırıncı', '#C98A4B', { arac: 'bread', kim: 'Who makes bread?' }), o('hairdresser', 'hairdresser', 'kuaför', '#1FA597', { arac: 'scissors', kim: 'Who cuts our hair?' }),
    o('driver', 'bus driver', 'şoför', '#2E8FE8', { arac: 'bus', kim: 'Who drives a bus?' }), o('gardener', 'gardener', 'bahçıvan', '#3FB86A', { arac: 'flower', kim: 'Who looks after plants?' })]);
  ekle('actions', [o('walk', 'walk', 'yürümek', '#2E8FE8'), o('sit', 'sit', 'oturmak', '#C98A4B'), o('stand', 'stand', 'ayakta durmak', '#3FB86A'), o('clap', 'clap', 'el çırpmak', '#E8A400'),
    o('kick', 'kick', 'tekmelemek', '#E5484D'), o('throw', 'throw', 'atmak', '#FF7A1A'), o('catch', 'catch', 'yakalamak', '#2E8FE8'), o('fly', 'fly', 'uçmak', '#E5484D'), o('cry', 'cry', 'ağlamak', '#4AA8FF'),
    o('laugh', 'laugh', 'gülmek', '#E8A400'), o('write', 'write', 'yazmak', '#8E7CF0'), o('cook', 'cook', 'yemek pişirmek', '#E5484D'), o('wash', 'wash', 'yıkamak', '#2E8FE8'), o('ride', 'ride a bike', 'bisiklet sürmek', '#E5484D')]);
  ekle('seasons', [o('flower', 'flower', 'çiçek', '#FF6FA5', { izle: 'Flowers grow in spring!' }), o('leaf', 'leaf', 'yaprak', '#FF7A1A', { izle: 'Leaves fall in autumn!', cogul: 'leaves' }),
    o('beach', 'beach', 'plaj', '#E8A400', { izle: 'We go to the beach in summer!' }), o('snowflake', 'snowflake', 'kar tanesi', '#2E8FE8', { izle: 'Snowflakes fall in winter!' }),
    o('sledge', 'sledge', 'kızak', '#E5484D', { izle: 'We ride a sledge in winter!' }), o('pumpkin', 'pumpkin', 'bal kabağı', '#FF7A1A', { izle: 'Pumpkins grow in autumn!' }),
    o('picnic', 'picnic', 'piknik', '#3FB86A', { izle: 'Let\'s have a picnic in spring!' }), o('nest', 'nest', 'kuş yuvası', '#B07A40', { izle: 'Birds make nests in spring!' })]);
  ekle('days', [o('today', 'today', 'bugün', '#E5484D', { izle: 'Today is a great day!' }), o('tomorrow', 'tomorrow', 'yarın', '#2E8FE8', { izle: 'See you tomorrow!' }),
    o('yesterday', 'yesterday', 'dün', '#7C8AA3', { izle: 'Yesterday was fun!' }), o('weekend', 'weekend', 'hafta sonu', '#FF6FA5', { izle: 'Hooray! It\'s the weekend!' }), o('week', 'week', 'hafta', '#3FB86A', { izle: 'There are seven days in a week!' })]);
  ekle('places', [o('between', 'between', 'arasında', '#8E7CF0', { cumle: 'The ball is between the boxes.' }), o('above', 'above', 'yukarısında', '#2E8FE8', { cumle: 'The ball is above the box.' }),
    o('near', 'near', 'yakınında', '#3FB86A', { cumle: 'The ball is near the box.' }), o('far', 'far', 'uzağında', '#E8A400', { cumle: 'The ball is far from the box.' })]);

  /* oyunların yeni kelimelere uyumu */
  var MEVSIM4 = ['spring', 'summer', 'autumn', 'winter'], GUN7 = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  K.al('seasons').oyun3.hedefler = function (l) { var x = l.filter(function (y) { return MEVSIM4.indexOf(y.id) > -1; }); return x.length ? x : l.filter(function () { return false; }); };
  K.al('days').oyun3.hedefler = function (l) { return l.filter(function (y) { return GUN7.indexOf(y.id) > -1; }); };
  K.al('clothes').oyun3.hedefler = function (l) { return l.filter(function (y) { return y.yer && y.hava; }); };
  K.al('jobs').oyun3.hedefler = function (l) { return l.filter(function (y) { return y.kim && y.arac; }); };
  var sc = K.al('school').oyun3, eskiSc = sc.hedefler; sc.hedefler = function (l) { return eskiSc(l).filter(function (y) { return ['playground', 'classroom', 'bell'].indexOf(y.id) < 0; }); };
  /* "a / an" doğru olsun: ambulance, owl, eel, arrow, astronaut… */
  K.al('transport').oyun3.dogru = function (x) { return 'It\'s ' + AN(x.en) + x.en + '!'; };
  K.al('transport').izleCumle = function (x) { return x.izle || 'It\'s ' + AN(x.en) + x.en + '!'; };
  K.al('animals').izleCumle = function (x) { return x.izle || 'It\'s ' + AN(x.en) + x.en + '!'; };
  K.al('sea').izleCumle = function (x) { return x.izle || (x.tek ? 'Look, ' + x.en + '!' : 'It\'s ' + AN(x.en) + x.en + '!'); };
  K.al('shapes').izleCumle = function (x) { return 'It\'s ' + AN(x.en) + x.en + '!'; };
  K.al('shapes').oyun3.dogru = function (x) { return 'It\'s ' + AN(x.en) + x.en + '!'; };
  K.al('seasons').izleCumle = function (x) { return x.izle || 'It\'s ' + x.en + '!'; };
  K.al('home').izleCumle = function (x) { return (x.cok ? 'These are my ' : 'This is my ') + x.en + '!'; };
  K.al('actions').izleCumle = function (x) { return 'I can ' + x.en + '!'; };
  K.al('family').izleCumle = function (x) { return x.id === 'me' ? 'This is me!' : x.cok ? 'These are my ' + x.en + '!' : x.id === 'neighbour' ? 'This is my neighbour!' : 'This is my ' + x.en + '!'; };
})(window);
