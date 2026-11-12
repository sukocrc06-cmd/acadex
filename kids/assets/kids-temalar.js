/* ==========================================================================
   ACADEX KIDS · on tema paketi (kids/assets/kids-temalar.js), 12.11.2026
   Animals, Family, My Body, Food, Toys, Clothes, My Home, School, Weather, Feelings.
   Her tema: yaşa göre 6 / 8 / 10 kelime (Minikler / Kâşifler / Yıldızlar), her
   kelimenin çizimi (kids-resim.js), Acadia'nın cümleleri, temaya özel üçüncü oyun,
   Acadex için yazılmış şarkı, çıkartmalar, veliye "evde söyleyin" cümleleri ve
   "evde 5 dakika" etkinlikleri. Oyun motorları kids-oyun2.js'de; burada yalnız
   içerik ve cümleler var. Paketler KIDS_KONU.ekle ile kaydolur.
   Sesli cümlelerin hepsi bu paketlerden kids/ses/katalog.js ile üretilir.
   ========================================================================== */
(function (W) {
  'use strict';
  var R = W.KIDS_RESIM, K = W.KIDS_KONU;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function vurgu(o, metin) { var i = metin.toLowerCase().indexOf(o.en.toLowerCase()); return i < 0 ? metin : metin.slice(0, i) + '<b style="--r:' + o.hex + '">' + metin.slice(i, i + o.en.length) + '</b>' + metin.slice(i + o.en.length); }
  function o(id, en, tr, hex, ek) { var x = { id: id, en: en, tr: tr, hex: hex }; for (var k in ek || {}) x[k] = ek[k]; return x; }

  function bantAdi(b) { var B = W.KIDS_VERI.BANT; for (var k in B) if (B[k] === b || B[k].ad === b.ad) return k; return 'kasif'; }
  /* ortak paket iskeleti: konu yalnız farklı olanı verir */
  function tema(t) {
    var p = {
      id: t.id,
      ogeler: function (bant) { return t.liste.slice(0, (t.say && bant.ad && t.say[bantAdi(bant)]) || bant.kelimeSay || 8); },
      gorsel: function (x) { return R.ciz(x.id); },
      izleGiris: t.giris,
      izleCumle: function (x) { return x.izle || t.izle(x); },
      dokunYon: t.dokun,
      balon: {
        soz: function (x) { return t.balon(x); },
        html: function (x) { return vurgu(x, esc(t.balon(x))); },
        ciz: function (x) { return R.balonResim(x.id, x.hex); },
        /* yanlış balon: önce dokunulanın adı, sonra yönerge yinelenir (iki kısa cümle) */
        yanlis: function (y, x) { return [y.en + '.', t.balon(x)]; }
      },
      hafiza: {
        soz: t.hafiza,
        a: function (x) { return R.ciz(x.id); },
        b: function (x, bant) { return bant.kelimeKart ? '<b lang="en" style="--r:' + x.hex + '">' + esc(x.en) + '</b>' : bant.yazi ? '<span class="ko-resimk">' + R.ciz(x.id) + '<small lang="en">' + esc(x.en) + '</small></span>' : R.ciz(x.id); }
      },
      oyun3: t.oyun3, cikartma: t.cikartma, sarki: t.sarki, ev: t.ev, etkinlik: t.etkinlik, liste: t.liste, karisik: t.karisik || false,
      bitis: 'Great job! ' + t.ad + ', done!'
    };
    K.ekle(t.id, p);
    return p;
  }
  var pop = function (x) { return 'Pop the ' + x.en.toLowerCase() + '!'; };
  var kucuk = function (x) { return x.en.toLowerCase(); };

  /* ---------------- Animals ---------------- */
  tema({
    id: 'animals', ad: 'Animals', giris: 'Let\'s meet the animals!', dokun: 'Hayvanlara dokun ve dinle.', hafiza: 'Find the same animals!', balon: pop,
    izle: function (x) { return 'It\'s a ' + kucuk(x) + '!'; },
    liste: [o('cat', 'cat', 'kedi', '#FF9F45', { ses: 'Meow' }), o('dog', 'dog', 'köpek', '#D9A35E', { ses: 'Woof' }), o('fish', 'fish', 'balık', '#4AA8FF', { cogul: 'fish' }), o('bird', 'bird', 'kuş', '#F2B92A', { ses: 'Tweet' }),
      o('rabbit', 'rabbit', 'tavşan', '#FF8FB0'), o('frog', 'frog', 'kurbağa', '#3FB86A', { ses: 'Ribbit' }), o('cow', 'cow', 'inek', '#7C8AA3', { ses: 'Moo' }), o('chick', 'chick', 'civciv', '#F2B92A', { ses: 'Cheep' }),
      o('lion', 'lion', 'aslan', '#E08A2E', { ses: 'Roar' }), o('bear', 'bear', 'ayı', '#B07A40')],
    oyun3: {
      id: 'sesbul', ad: 'Kim der?', simge: 'ses', motor: 'sec',
      hedefler: function (l) { return l.filter(function (x) { return x.ses; }); },
      soz: function (x) { var s = x.ses.toLowerCase(); return x.ses + ', ' + s + '! Who says ' + s + '?'; },
      dogru: function (x) { return 'The ' + x.en + ' says ' + x.ses.toLowerCase() + '!'; },
      son: 'You know all the animal sounds!'
    },
    cikartma: ['lion', 'cow', 'chick'],
    sarki: [
      { kim: 'cat', soz: 'The cat says meow, meow, meow!' },
      { kim: 'dog', soz: 'The dog says woof, woof, woof!' },
      { kim: 'frog', soz: 'The frog says ribbit, jump, jump, jump!' },
      { kim: 'cow', soz: 'The cow says moo on the farm!' },
      { kim: 'lion', soz: 'The lion says roar, big and strong!' },
      { kim: null, soz: 'Animals, animals, sing along!' }
    ],
    ev: [['What animal is it?', 'Bu hangi hayvan?'], ['It\'s a cat!', 'Bu bir kedi!'], ['The dog says woof.', 'Köpek hav hav der.']],
    etkinlik: [{ ad: 'Hayvan taklidi', adim: 'Bir hayvanın sesini çıkarın; çocuğunuz İngilizce adını söylesin: “Moo!” — “Cow!” Sonra sıra onda, siz bilin.' },
      { ad: 'Kitaptaki hayvanlar', adim: 'Bir resimli kitap ya da oyuncaklarla sorun: “What animal is it?” Doğru cevaba kocaman bir alkış.' }]
  });

  /* ---------------- Family ---------------- */
  var kim = function (x) { return x.the ? 'the ' + x.en : x.en; };
  tema({
    id: 'family', ad: 'Family', giris: 'Let\'s meet my family!', dokun: 'Aileye dokun ve dinle.', hafiza: 'Find the same people!',
    balon: function (x) { return 'Find ' + kim(x) + '!'; },
    izle: function (x) { return 'This is my ' + x.en + '!'; },
    liste: [o('mum', 'mum', 'anne', '#FF6FA5'), o('dad', 'dad', 'baba', '#2E8FE8'), o('baby', 'baby', 'bebek', '#E8B820', { the: 1 }), o('sister', 'sister', 'kız kardeş', '#8E7CF0'),
      o('brother', 'brother', 'erkek kardeş', '#3FB86A'), o('grandma', 'grandma', 'büyükanne', '#B58AE0'), o('grandpa', 'grandpa', 'büyükbaba', '#B07A40'), o('family', 'family', 'aile', '#E5484D', { the: 1, foto: 0 }),
      o('aunt', 'aunt', 'teyze / hala', '#FF8A3D'), o('uncle', 'uncle', 'amca / dayı', '#1FA597')],
    oyun3: {
      id: 'foto', ad: 'Fotoğraf', simge: 'family', motor: 'yerlestir', kap: 'cerceve',
      hedefler: function (l) { return l.filter(function (x) { return x.id !== 'family'; }); },
      soz: function (x) { return 'Put ' + kim(x) + ' in the photo!'; },
      dogru: function (x) { return x.en + '!'; },
      son: 'Say cheese! What a happy family!'
    },
    cikartma: ['family', 'baby', 'grandma'],
    sarki: [
      { kim: 'mum', soz: 'Mum and me, we like to play!' },
      { kim: 'dad', soz: 'Dad and me, we laugh all day!' },
      { kim: 'baby', soz: 'Baby is small, hello, hello!' },
      { kim: 'sister', soz: 'Sister and brother, me too, me too!' },
      { kim: 'grandma', soz: 'Grandma and grandpa, a big hug for you!' },
      { kim: null, soz: 'I love my family, yes, I do!' }
    ],
    ev: [['Who is this?', 'Bu kim?'], ['This is my mum.', 'Bu benim annem.'], ['I love you, Dad!', 'Seni seviyorum baba!']],
    etkinlik: [{ ad: 'Aile albümü', adim: 'Bir aile fotoğrafına birlikte bakın. Her kişiyi gösterip sorun: “Who is this?” — “Grandma!”' },
      { ad: 'Sarılma oyunu', adim: '“Hug mum!”, “Hug dad!” deyin; çocuğunuz söylenen kişiye koşup sarılsın. Sonra komutu o versin.' }]
  });

  /* ---------------- My Body ---------------- */
  tema({
    id: 'body', ad: 'My body', giris: 'Let\'s learn my body!', dokun: 'Vücudumuza dokun ve dinle.', hafiza: 'Find the pairs!', balon: pop,
    izle: function (x) { return (x.cok ? 'These are my ' : 'This is my ') + x.en + '!'; },
    liste: [o('head', 'head', 'baş', '#E8875A'), o('eyes', 'eyes', 'gözler', '#2E8FE8', { cok: 1 }), o('ears', 'ears', 'kulaklar', '#FF8A3D', { cok: 1 }), o('nose', 'nose', 'burun', '#F0607A'),
      o('mouth', 'mouth', 'ağız', '#E5484D'), o('hands', 'hands', 'eller', '#E8B820', { cok: 1 }), o('hair', 'hair', 'saç', '#8F5A3A'), o('feet', 'feet', 'ayaklar', '#3FB86A', { cok: 1 }),
      o('arms', 'arms', 'kollar', '#8E7CF0', { cok: 1 }), o('legs', 'legs', 'bacaklar', '#1FA597', { cok: 1 })],
    oyun3: {
      id: 'simon', ad: 'Dokun!', simge: 'hands', motor: 'simon',
      soz: function (x) { return 'Touch your ' + x.en + '!'; },
      dogru: function (x) { return x.en + '!'; },
      son: 'Super! You know your body!'
    },
    cikartma: ['hands', 'eyes', 'feet'],
    sarki: [
      { kim: 'head', soz: 'Head and hands, clap, clap, clap!' },
      { kim: 'eyes', soz: 'Eyes and ears, look and listen!' },
      { kim: 'nose', soz: 'Nose and mouth, smell and taste!' },
      { kim: 'feet', soz: 'Feet go stamp, stamp, stamp!' },
      { kim: 'arms', soz: 'Arms up high, legs jump, jump!' },
      { kim: null, soz: 'This is my body, look at me!' }
    ],
    ev: [['Touch your nose!', 'Burnuna dokun!'], ['Clap your hands!', 'Ellerini çırp!'], ['These are my eyes.', 'Bunlar benim gözlerim.']],
    etkinlik: [{ ad: 'Simon says', adim: '“Touch your nose!”, “Touch your ears!” deyin, çocuğunuz dokunsun. Sonra rolleri değiştirin: o söylesin, siz yapın.' },
      { ad: 'Ayna oyunu', adim: 'Aynanın karşısına geçin; gösterdiğiniz yeri çocuğunuz İngilizce söylesin: “Eyes!”, “Mouth!”' }]
  });

  /* ---------------- Food ---------------- */
  tema({
    id: 'food', ad: 'Food', giris: 'Let\'s eat! Yummy food!', dokun: 'Yiyeceklere dokun ve dinle.', hafiza: 'Find the same food!', balon: pop,
    izle: function (x) { return 'Yummy, ' + x.bir + '!'; },
    liste: [o('apple', 'apple', 'elma', '#E5484D', { bir: 'an apple', cok: 'apples' }), o('banana', 'banana', 'muz', '#E8B820', { bir: 'a banana', cok: 'bananas' }), o('bread', 'bread', 'ekmek', '#C98A4B', { bir: 'bread', cok: 'bread', tek: 1 }),
      o('milk', 'milk', 'süt', '#2E8FE8', { bir: 'milk', cok: 'milk', tek: 1 }), o('egg', 'egg', 'yumurta', '#E8A400', { bir: 'an egg', cok: 'eggs' }), o('cake', 'cake', 'pasta', '#FF6FA5', { bir: 'a cake', cok: 'cake', tek: 1 }),
      o('cheese', 'cheese', 'peynir', '#D9A400', { bir: 'cheese', cok: 'cheese', tek: 1 }), o('carrot', 'carrot', 'havuç', '#FF7A1A', { bir: 'a carrot', cok: 'carrots' }),
      o('strawberry', 'strawberry', 'çilek', '#F0405A', { bir: 'a strawberry', cok: 'strawberries' }), o('juice', 'juice', 'meyve suyu', '#F28C00', { bir: 'juice', cok: 'juice', tek: 1 })],
    oyun3: {
      id: 'piknik', ad: 'Piknik', simge: 'cake', motor: 'yerlestir', kap: 'sepet',
      soz: function (x) { return 'I like ' + x.cok + '! Put ' + (x.tek ? 'it' : 'them') + ' in the basket.'; },
      dogru: function () { return 'Yummy!'; },
      son: 'Let\'s have a picnic!'
    },
    cikartma: ['cake', 'banana', 'juice'],
    sarki: [
      { kim: 'apple', soz: 'Apples, apples, crunch, crunch, crunch!' },
      { kim: 'banana', soz: 'Bananas are yellow, yum, yum, yum!' },
      { kim: 'milk', soz: 'Milk and bread for breakfast time!' },
      { kim: 'cake', soz: 'Cake for a party, one, two, three!' },
      { kim: 'carrot', soz: 'Carrots are orange, good for me!' },
      { kim: null, soz: 'I like food, food, yummy food!' }
    ],
    ev: [['I like apples.', 'Elmayı severim.'], ['I\'m hungry!', 'Acıktım!'], ['Yummy!', 'Çok lezzetli!']],
    etkinlik: [{ ad: 'Mutfak avı', adim: 'Mutfakta bir yiyecek gösterin: “What is it?” Çocuğunuz İngilizce adını söylesin; bilirse ondan bir ısırık!' },
      { ad: 'Sevdiklerimiz', adim: 'Sofrada sırayla söyleyin: “I like bread.”, “I like milk.” Çocuğunuz da kendi cümlesini kursun.' }]
  });

  /* ---------------- Toys ---------------- */
  tema({
    id: 'toys', ad: 'Toys', giris: 'Let\'s play with toys!', dokun: 'Oyuncaklara dokun ve dinle.', hafiza: 'Find the same toys!', balon: pop,
    izle: function (x) { return 'Look, ' + x.bir + '!'; },
    liste: [o('ball', 'ball', 'top', '#2E8FE8', { bir: 'a ball' }), o('car', 'car', 'araba', '#E5484D', { bir: 'a car' }), o('teddy', 'teddy', 'oyuncak ayı', '#B07A40', { bir: 'a teddy' }), o('doll', 'doll', 'oyuncak bebek', '#FF6FA5', { bir: 'a doll' }),
      o('kite', 'kite', 'uçurtma', '#E8B820', { bir: 'a kite' }), o('blocks', 'blocks', 'bloklar', '#3FB86A', { bir: 'blocks', cok: 1 }), o('train', 'train', 'tren', '#FF7A1A', { bir: 'a train' }), o('robot', 'robot', 'robot', '#8E7CF0', { bir: 'a robot' }),
      o('drum', 'drum', 'davul', '#F0405A', { bir: 'a drum' }), o('balloon', 'balloon', 'balon', '#1FA597', { bir: 'a balloon' })],
    oyun3: {
      id: 'kutu', ad: 'Topla', simge: 'teddy', motor: 'yerlestir', kap: 'kutu',
      soz: function (x) { return 'Put the ' + x.en + ' in the box!'; },
      dogru: function (x) { return 'The ' + x.en + (x.cok ? ' are' : ' is') + ' in the box!'; },
      son: 'All tidy! Well done!'
    },
    cikartma: ['teddy', 'robot', 'kite'],
    sarki: [
      { kim: 'ball', soz: 'Bounce the ball, bounce, bounce, bounce!' },
      { kim: 'car', soz: 'Drive the car, beep, beep, beep!' },
      { kim: 'teddy', soz: 'Hug my teddy, nice and tight!' },
      { kim: 'kite', soz: 'Fly my kite up in the sky!' },
      { kim: 'train', soz: 'The train goes choo, choo, choo!' },
      { kim: null, soz: 'Toys, toys, let\'s play with toys!' }
    ],
    ev: [['Let\'s play!', 'Hadi oynayalım!'], ['Where is the ball?', 'Top nerede?'], ['Tidy up, please.', 'Lütfen topla.']],
    etkinlik: [{ ad: 'Toplama şarkısı', adim: 'Oyuncakları toplarken her birini söyleyin: “Put the car in the box!” Kutuya giren her oyuncağa bir alkış.' },
      { ad: 'Gizli oyuncak', adim: 'Bir oyuncağı örtünün altına saklayın, birazını göstererek sorun: “What is it?” — “A teddy!”' }]
  });

  /* ---------------- Clothes ---------------- */
  tema({
    id: 'clothes', ad: 'Clothes', giris: 'Let\'s get dressed!', dokun: 'Kıyafetlere dokun ve dinle.', hafiza: 'Find the same clothes!', balon: pop,
    izle: function (x) { return 'Put on your ' + kucuk(x) + '!'; },
    liste: [o('hat', 'hat', 'şapka', '#E8B820', { yer: 'bas', hava: 'sunny', durum: 'It\'s sunny!' }), o('tshirt', 'T-shirt', 'tişört', '#3FB86A', { yer: 'govde', hava: 'hot', durum: 'It\'s hot!' }),
      o('dress', 'dress', 'elbise', '#FF6FA5', { yer: 'govde', hava: 'balloon', durum: 'It\'s a party!' }), o('shoes', 'shoes', 'ayakkabı', '#2E8FE8', { cok: 1, yer: 'ayak', hava: 'kite', durum: 'Let\'s go out!' }),
      o('socks', 'socks', 'çorap', '#E5484D', { cok: 1, yer: 'ayak', hava: 'cold', durum: 'Your feet are cold!' }), o('coat', 'coat', 'mont', '#B07A40', { yer: 'govde', hava: 'cold', durum: 'It\'s cold!' }),
      o('scarf', 'scarf', 'atkı', '#F0405A', { yer: 'boyun', hava: 'windy', durum: 'It\'s windy!' }), o('gloves', 'gloves', 'eldiven', '#8E7CF0', { cok: 1, yer: 'el', hava: 'snowy', durum: 'It\'s snowy!' }),
      o('trousers', 'trousers', 'pantolon', '#2E7DD8', { cok: 1, yer: 'bacak', hava: 'bag', durum: 'Let\'s go to school!' }), o('boots', 'boots', 'çizme', '#E8A400', { cok: 1, yer: 'ayak', hava: 'rainy', durum: 'It\'s rainy!' })],
    oyun3: {
      id: 'giydir', ad: 'Giydir', simge: 'tshirt', motor: 'yerlestir', kap: 'giy',
      soz: function (x) { return x.durum + ' Put on your ' + kucuk(x) + '.'; },
      dogru: function (x) { return x.en + '!'; },
      son: 'You look great!'
    },
    cikartma: ['hat', 'boots', 'scarf'],
    sarki: [
      { kim: 'hat', soz: 'Put on your hat, it\'s sunny today!' },
      { kim: 'coat', soz: 'Put on your coat, it\'s cold today!' },
      { kim: 'shoes', soz: 'Shoes and socks, let\'s go and play!' },
      { kim: 'scarf', soz: 'Scarf and gloves, the snow is here!' },
      { kim: 'boots', soz: 'Boots in the rain, splash, splash, splash!' },
      { kim: null, soz: 'Clothes, clothes, I can dress myself!' }
    ],
    ev: [['Put on your shoes.', 'Ayakkabılarını giy.'], ['It\'s cold! Put on your coat.', 'Hava soğuk! Montunu giy.'], ['I like my hat.', 'Şapkamı seviyorum.']],
    etkinlik: [{ ad: 'Giyinme sunucusu', adim: 'Sabah giyinirken her parçayı söyleyin: “Socks on! Shoes on!” Çocuğunuz sizinle tekrar etsin.' },
      { ad: 'Havaya bak, giyin', adim: 'Pencereden bakın: “It\'s cold!” Çocuğunuz hangi kıyafeti seçeceğini göstersin ve söylesin: “Coat!”' }]
  });

  /* ---------------- My Home ---------------- */
  var ODA = [{ id: 'bedroom', en: 'bedroom', tr: 'yatak odası', hex: '#8E7CF0', simge: 'ay' }, { id: 'kitchen', en: 'kitchen', tr: 'mutfak', hex: '#FF8A3D', simge: 'tencere' },
    { id: 'living', en: 'living room', tr: 'oturma odası', hex: '#3FB86A', simge: 'tv' }, { id: 'bathroom', en: 'bathroom', tr: 'banyo', hex: '#2E8FE8', simge: 'dus' }];
  tema({
    id: 'home', ad: 'My home', giris: 'Welcome to my home!', dokun: 'Evdeki eşyalara dokun ve dinle.', hafiza: 'Find the same things!', balon: pop,
    izle: function (x) { return 'This is my ' + x.en + '!'; },
    liste: [o('bed', 'bed', 'yatak', '#2E8FE8', { oda: ['bedroom'] }), o('sofa', 'sofa', 'kanepe', '#E5484D', { oda: ['living'] }), o('table', 'table', 'masa', '#B07A40', { oda: ['kitchen'] }), o('chair', 'chair', 'sandalye', '#C98A4B', { oda: ['kitchen', 'living'] }),
      o('bath', 'bath', 'küvet', '#1FA597', { oda: ['bathroom'] }), o('lamp', 'lamp', 'lamba', '#E8B820', { oda: ['bedroom', 'living'] }), o('fridge', 'fridge', 'buzdolabı', '#7C8AA3', { oda: ['kitchen'] }), o('door', 'door', 'kapı', '#8F5A3A'),
      o('window', 'window', 'pencere', '#3BAED8'), o('clock', 'clock', 'saat', '#8E7CF0', { oda: ['living', 'kitchen', 'bedroom'] })],
    oyun3: {
      id: 'oda', ad: 'Odalar', simge: 'sofa', motor: 'sec', odalar: ODA,
      hedefler: function (l) { return l.filter(function (x) { return x.oda; }); },
      soz: function (x) { return 'Where does the ' + x.en + ' go?'; },
      dogru: function (x, oda) { return 'The ' + x.en + ' goes in the ' + oda.en + '!'; },
      son: 'Everything is in the right room!'
    },
    cikartma: ['sofa', 'lamp', 'clock'],
    sarki: [
      { kim: 'bed', soz: 'This is my bed, good night, sleep tight!' },
      { kim: 'sofa', soz: 'Sit on the sofa, one, two, three!' },
      { kim: 'table', soz: 'Table and chair, it\'s time to eat!' },
      { kim: 'bath', soz: 'Splash in the bath, splash, splash, splash!' },
      { kim: 'door', soz: 'Open the door, knock, knock, knock!' },
      { kim: null, soz: 'Home, home, I love my home!' }
    ],
    ev: [['Where is the lamp?', 'Lamba nerede?'], ['Open the door, please.', 'Kapıyı aç lütfen.'], ['This is my bed.', 'Bu benim yatağım.']],
    etkinlik: [{ ad: 'Ev turu', adim: 'Evde dolaşıp eşyaları gösterin: “What is it?” — “A sofa!” Her odada bir eşyanın adını çocuğunuz söylesin.' },
      { ad: 'Resimli etiketler', adim: 'Kâğıda küçük resimler çizip eşyalara yapıştırın (bed, door, chair). Bir hafta her geçişte birlikte söyleyin.' }]
  });

  /* ---------------- School ---------------- */
  tema({
    id: 'school', ad: 'School', giris: 'Let\'s go to school!', dokun: 'Okul eşyalarına dokun ve dinle.', hafiza: 'Find the same school things!', balon: pop,
    izle: function (x) { return (x.cok ? 'These are my ' : 'This is my ') + x.en + '!'; },
    liste: [o('pencil', 'pencil', 'kalem', '#E8A400'), o('book', 'book', 'kitap', '#2E8FE8'), o('bag', 'bag', 'çanta', '#E5484D'), o('crayons', 'crayons', 'pastel boya', '#FF7A1A', { cok: 1 }),
      o('scissors', 'scissors', 'makas', '#8E7CF0', { cok: 1 }), o('glue', 'glue', 'yapıştırıcı', '#1FA597'), o('ruler', 'ruler', 'cetvel', '#D9A400'), o('eraser', 'eraser', 'silgi', '#F06A95'),
      o('desk', 'desk', 'sıra', '#B07A40'), o('board', 'board', 'tahta', '#2F7D5B')],
    oyun3: {
      id: 'canta', ad: 'Çanta', simge: 'bag', motor: 'yerlestir', kap: 'canta',
      hedefler: function (l) { return l.filter(function (x) { return ['bag', 'desk', 'board'].indexOf(x.id) < 0; }); },
      /* okula gitmeyen birkaç şey de tepside: çocuk doğru eşyayı ayırır */
      yabanci: ['teddy', 'cake', 'ball'],
      soz: function (x) { return 'Put the ' + x.en + ' in your bag!'; },
      dogru: function (x) { return x.en + '!'; },
      son: 'Your bag is ready for school!'
    },
    cikartma: ['bag', 'crayons', 'book'],
    sarki: [
      { kim: 'bag', soz: 'Pack my bag, it\'s time for school!' },
      { kim: 'pencil', soz: 'A pencil and a book, look, look, look!' },
      { kim: 'crayons', soz: 'Crayons for colours, draw, draw, draw!' },
      { kim: 'scissors', soz: 'Scissors and glue, cut and stick!' },
      { kim: 'ruler', soz: 'A ruler and an eraser, nice and neat!' },
      { kim: null, soz: 'School, school, I love my school!' }
    ],
    ev: [['Where is your bag?', 'Çantan nerede?'], ['I have a pencil.', 'Bir kalemim var.'], ['Let\'s go to school!', 'Hadi okula gidelim!']],
    etkinlik: [{ ad: 'Çanta hazırlığı', adim: 'Akşam çantayı birlikte hazırlayın; her eşyayı koyarken söyleyin: “Pencil, in! Book, in!”' },
      { ad: 'Ne eksik?', adim: 'Masaya üç okul eşyası koyun, çocuğunuz gözünü kapatsın, birini saklayın: “What is missing?” — “The ruler!”' }]
  });

  /* ---------------- Weather ---------------- */
  tema({
    id: 'weather', ad: 'Weather', giris: 'What\'s the weather like?', dokun: 'Havalara dokun ve dinle.', hafiza: 'Find the same weather!',
    balon: function (x) { return 'Pop the ' + x.en + ' balloon!'; },
    izle: function (x) { return 'It\'s ' + x.en + '!'; },
    liste: [o('sunny', 'sunny', 'güneşli', '#E8A400'), o('rainy', 'rainy', 'yağmurlu', '#2E8FE8'), o('cloudy', 'cloudy', 'bulutlu', '#7C8AA3'), o('windy', 'windy', 'rüzgârlı', '#1FA597'),
      o('snowy', 'snowy', 'karlı', '#3BAED8'), o('hot', 'hot', 'sıcak', '#E5484D'), o('cold', 'cold', 'soğuk', '#2E7DD8'), o('rainbow', 'rainbow', 'gökkuşağı', '#8E7CF0', { izle: 'Look, a rainbow!', gun: 'There\'s a rainbow today!' }),
      o('stormy', 'stormy', 'fırtınalı', '#5B6478'), o('foggy', 'foggy', 'sisli', '#8A94A8')],
    oyun3: {
      id: 'cark', ad: 'Çark', simge: 'sunny', motor: 'sec', cark: 1,
      soz: function (x) { return x.gun || 'It\'s ' + x.en + ' today!'; },
      dogru: function (x) { return x.izle || 'It\'s ' + x.en + '!'; },
      son: 'You are a weather star!'
    },
    cikartma: ['sunny', 'snowy', 'rainbow'],
    sarki: [
      { kim: 'sunny', soz: 'Sunny, sunny, hello, sun!' },
      { kim: 'rainy', soz: 'Rainy, rainy, drip, drop, drip!' },
      { kim: 'windy', soz: 'Windy, windy, whoosh, whoosh, whoosh!' },
      { kim: 'snowy', soz: 'Snowy, snowy, white and cold!' },
      { kim: 'rainbow', soz: 'Look up high, a rainbow in the sky!' },
      { kim: null, soz: 'What\'s the weather? Let\'s look outside!' }
    ],
    ev: [['What\'s the weather like?', 'Hava nasıl?'], ['It\'s sunny!', 'Hava güneşli!'], ['It\'s cold today.', 'Bugün hava soğuk.']],
    etkinlik: [{ ad: 'Hava sunucusu', adim: 'Her sabah pencereden bakın; çocuğunuz hava sunucusu olsun: “Today it\'s sunny!”' },
      { ad: 'Hava hareketleri', adim: '“Rainy!” deyince parmaklarla yağmur, “Windy!” deyince sallanma, “Sunny!” deyince kollar güneş gibi açılsın.' }]
  });

  /* ---------------- Feelings ---------------- */
  tema({
    id: 'feelings', ad: 'Feelings', giris: 'How do you feel today?', dokun: 'Yüzlere dokun ve dinle.', hafiza: 'Find the same faces!',
    balon: function (x) { return 'Pop the ' + x.en + ' face!'; },
    izle: function (x) { return 'I\'m ' + x.en + '!'; },
    liste: [o('happy', 'happy', 'mutlu', '#E8A400', { durum: 'It\'s my birthday!', resim: 'cake' }), o('sad', 'sad', 'üzgün', '#2E8FE8', { durum: 'My balloon flew away.', resim: 'balloon' }),
      o('angry', 'angry', 'kızgın', '#E5484D', { durum: 'He took my toy!', resim: 'teddy' }), o('scared', 'scared', 'korkmuş', '#8E7CF0', { durum: 'A big storm!', resim: 'stormy' }),
      o('surprised', 'surprised', 'şaşkın', '#FF7A1A', { durum: 'A present for me!', resim: 'hediye' }), o('tired', 'tired', 'yorgun', '#7C8AA3', { durum: 'I played all day.', resim: 'bed' }),
      o('hungry', 'hungry', 'aç', '#3FB86A', { durum: 'It\'s lunch time!', resim: 'bread' }), o('excited', 'excited', 'heyecanlı', '#FF6FA5', { durum: 'We\'re going to the park!', resim: 'kite' }),
      o('shy', 'shy', 'utangaç', '#F06A95', { durum: 'Hello! I\'m new here.', resim: 'brother' }), o('bored', 'bored', 'sıkılmış', '#8A94A8', { durum: 'There\'s nothing to do.', resim: 'clock' })],
    oyun3: {
      id: 'yuz', ad: 'Nasılım?', simge: 'happy', motor: 'sec', durum: 1,
      soz: function (x) { return x.durum + ' How do I feel?'; },
      dogru: function (x) { return 'I feel ' + x.en + '!'; },
      son: 'You understand feelings!'
    },
    cikartma: ['happy', 'excited', 'surprised'],
    sarki: [
      { kim: 'happy', soz: 'When I\'m happy, I jump and smile!' },
      { kim: 'sad', soz: 'When I\'m sad, I need a hug!' },
      { kim: 'angry', soz: 'When I\'m angry, I breathe in slow!' },
      { kim: 'scared', soz: 'When I\'m scared, I hold your hand!' },
      { kim: 'tired', soz: 'When I\'m tired, I go to bed!' },
      { kim: null, soz: 'Feelings, feelings, it\'s OK to feel!' }
    ],
    ev: [['How do you feel?', 'Nasıl hissediyorsun?'], ['I\'m happy!', 'Mutluyum!'], ['Are you tired?', 'Yoruldun mu?']],
    etkinlik: [{ ad: 'Duygu aynası', adim: 'Aynada bir yüz ifadesi yapın: “I\'m sad.” Çocuğunuz aynısını yapıp söylesin. Sonra o yapsın, siz tahmin edin.' },
      { ad: 'Gün sonu sohbeti', adim: 'Yatmadan önce sorun: “How do you feel?” Çocuğunuz bir duygu seçsin, nedenini Türkçe anlatsın.' }]
  });

  W.KIDS_TEMALAR = { ODA: ODA, tema: tema, o: o, vurgu: vurgu };
})(window);
