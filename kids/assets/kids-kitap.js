/* ==========================================================================
   ACADEX KIDS · hikâye kitaplığı (kids/assets/kids-kitap.js), 12.11.2026
   Her konuya bir resimli, sesli, OLAYLI hikâye (yaşa göre 6-8 sayfa) ve sonunda 3 resimli soru.
   Okurken katılım: nakaratı birlikte söyle, resimde bir şeye dokun, sayfa çevrilmeden tahmin et.
   Sayfa açılınca Acadia okur, okunan kelime yanar; kelimeye dokununca o kelime okunur.
   Hikâyeler Acadex için yazıldı; resimler kids-resim çizimlerinden kurulur.
   Okunan kitap çocuğun ilerlemesine (il.kitap) işlenir; kitaplıkta ✓ görünür.
   Kaynak: KIDS_KITAP.LISTE (katalog bu listeden seslendirir). W.KIDS_KITAP
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, C = W.KIDS_CIZ, R = W.KIDS_RESIM, V = W.KIDS_VERI, SES = W.KIDS_SES;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  /* sayfa: [cümle, [resimler], ek]; ek = { n: nakarat (çocuk tekrar eder), d: dokunulacak resim, t: [tahmin sorusu, doğru, [seçenekler]] } */
  function k(id, konu, sv, ad, tr, sayfa, soru) { return { id: id, konu: konu, sv: sv, ad: ad, tr: tr, sayfalar: sayfa.map(function (x) { var e = x[2] || {}; return { s: x[0], r: x[1], n: e.n || null, d: e.d || null, t: e.t ? { s: e.t[0], c: e.t[1], y: e.t[2] } : null }; }), sorular: soru.map(function (x) { return { s: x[0], c: x[1], y: x[2] }; }) }; }
  /* 13.11.2026: her kitapta bir olay var ve yaşa göre üç seviye:
     1 Minikler  · 6 sayfa, kısa cümle, tekrar eden nakarat (kayıp → arama → bulma)
     2 Kâşifler  · 7 sayfa, sorun → denemeler → çözüm
     3 Yıldızlar · 8 sayfa, duygu ve sürpriz son
     Hikâyeler Acadex için yazıldı. */
  var LISTE = [
    k('boya', 'colours', 1, 'Where Is My Ball?', 'Topum nerede?', [['Kitty has a red ball.', ['cat', 'ball']], ['Oh no! Where is my ball?', ['cat', 'sad'], { n: 'Where is my ball?' }], ['Is it in the blue bag? No!', ['blue', 'bag']],
      ['Is it on the yellow chair? No!', ['yellow', 'chair'], { t: ['Who has the ball?', 'dog', ['dog', 'bird', 'fish']] }], ['Look! Puppy has the red ball!', ['dog', 'ball'], { d: 'ball' }], ['Kitty and Puppy play. Hooray!', ['cat', 'dog', 'happy']]],
      [['What colour is the ball?', 'red', ['red', 'blue', 'yellow']], ['Who has the ball?', 'dog', ['dog', 'bird', 'fish']], ['How is Kitty at the end?', 'happy', ['happy', 'sad', 'angry']]]),
    k('yildizlar', 'numbers', 1, 'Three Hungry Chicks', 'Üç aç civciv', [['Hen has three hungry chicks.', ['hen', 'chick', 'chick', 'chick']], ['Cheep, cheep! We are hungry!', ['chick', 'hungry'], { n: 'We are hungry!' }], ['One apple falls. Bump!', ['apple']],
      ['Two apples fall. Bump, bump!', ['apple', 'apple'], { t: ['How many apples next?', 'three', ['three', 'one', 'five']] }], ['Three apples fall! One, two, three!', ['apple', 'apple', 'apple'], { d: 'apple' }], ['One apple for each chick. Yummy!', ['chick', 'apple', 'happy']]],
      [['How many chicks?', 'three', ['three', 'two', 'ten']], ['What falls from the tree?', 'apple', ['apple', 'banana', 'egg']], ['Who is hungry?', 'chick', ['chick', 'cow', 'fish']]]),
    k('ciftlik', 'animals', 1, 'Where Is My Puppy?', 'Köpeğim nerede?', [['Tom can\'t find his puppy.', ['boy', 'sad']], ['Puppy, puppy, where are you?', ['boy'], { n: 'Puppy, puppy, where are you?' }], ['Is it you? Moo! No, I\'m a cow.', ['cow']],
      ['Is it you? Quack! No, I\'m a duck.', ['duck'], { t: ['Who comes next?', 'dog', ['dog', 'pig', 'sheep']] }], ['Woof, woof! Here I am!', ['dog'], { d: 'dog' }], ['Tom hugs his puppy. Good dog!', ['boy', 'dog', 'happy']]],
      [['Who says moo?', 'cow', ['cow', 'pig', 'duck']], ['Who says quack?', 'duck', ['duck', 'dog', 'cow']], ['Who does Tom find?', 'dog', ['dog', 'cat', 'pig']]]),
    k('dogumgunu', 'family', 1, 'A Cake for Grandma', 'Büyükanneye pasta', [['It is Grandma\'s birthday.', ['grandma']], ['Mum makes a big cake.', ['mum', 'cake']], ['Oh no! The baby wants the cake!', ['baby', 'cake'], { t: ['Who stops the baby?', 'dad', ['dad', 'grandpa', 'sister']] }],
      ['Dad says: Wait, baby! Wait!', ['dad', 'baby'], { n: 'Wait, baby! Wait!' }], ['Surprise! Happy birthday, Grandma!', ['grandma', 'cake'], { d: 'cake' }], ['Everyone eats cake. Baby too!', ['baby', 'cake', 'happy']]],
      [['Whose birthday is it?', 'grandma', ['grandma', 'dad', 'baby']], ['What does Mum make?', 'cake', ['cake', 'pizza', 'soup']], ['Who wants the cake?', 'baby', ['baby', 'brother', 'dad']]]),
    k('freddy', 'body', 1, 'Wash, Wash, Wash!', 'Yıka, yıka, yıka!', [['Bunny plays in a puddle. Oh no!', ['rabbit', 'puddle']], ['Wash, wash, wash! Splash!', ['bath'], { n: 'Wash, wash, wash!' }], ['Wash your hands.', ['hands']],
      ['Wash your face and your nose.', ['face', 'nose'], { t: ['What does Bunny wash next?', 'ears', ['ears', 'hat', 'ball']] }], ['Wash your long ears!', ['ears', 'rabbit'], { d: 'ears' }], ['Now Bunny is clean. Good night!', ['rabbit', 'bed']]],
      [['Who plays in the puddle?', 'rabbit', ['rabbit', 'cat', 'dog']], ['What does Bunny wash first?', 'hands', ['hands', 'feet', 'hair']], ['Where is Bunny at the end?', 'bed', ['bed', 'bath', 'sofa']]]),
    k('ayi', 'food', 1, 'The Hungry Bear', 'Aç ayı', [['Bear is very hungry.', ['bear', 'hungry']], ['Yum, yum! I want more!', ['bear'], { n: 'Yum, yum! I want more!' }], ['He eats one apple.', ['apple']],
      ['He eats bread and cheese.', ['bread', 'cheese'], { t: ['What does Bear eat next?', 'cake', ['cake', 'ball', 'hat']] }], ['He eats a big cake!', ['cake', 'bear'], { d: 'cake' }], ['Oh! My tummy! Bear is sleepy now.', ['tummy', 'sleepy']]],
      [['Who is hungry?', 'bear', ['bear', 'lion', 'pig']], ['What does Bear eat first?', 'apple', ['apple', 'cake', 'bread']], ['How is Bear at the end?', 'sleepy', ['sleepy', 'angry', 'scared']]]),
    k('ayicik', 'toys', 1, 'Where Is My Teddy?', 'Ayıcığım nerede?', [['Mia can\'t find her teddy.', ['girl', 'sad']], ['Teddy, teddy, where are you?', ['girl'], { n: 'Teddy, teddy, where are you?' }], ['Is he in the toy car? No.', ['car']],
      ['Is he with the robot? No.', ['robot'], { t: ['Where is Teddy?', 'bed', ['bed', 'bath', 'fridge']] }], ['Look! Teddy is in the bed!', ['bed', 'teddy'], { d: 'teddy' }], ['Good night, Teddy. Good night, Mia.', ['girl', 'teddy', 'sleepy']]],
      [['What can\'t Mia find?', 'teddy', ['teddy', 'ball', 'kite']], ['Where is Teddy?', 'bed', ['bed', 'car', 'bath']], ['Who is not with Teddy?', 'robot', ['robot', 'girl', 'bed']]]),
    k('pazar', 'fruits', 1, 'The Big Watermelon', 'Kocaman karpuz', [['Mum and I go to the market.', ['mum', 'bag']], ['I want a big watermelon!', ['watermelon'], { n: 'I want a big watermelon!' }], ['Mum buys three oranges.', ['orangefruit', 'orangefruit', 'orangefruit']],
      ['Mum buys grapes.', ['grapes'], { t: ['What do I want?', 'watermelon', ['watermelon', 'lemon', 'pear']] }], ['Oh! The watermelon is so heavy!', ['watermelon', 'surprised'], { d: 'watermelon' }], ['Dad helps. We eat it all. Yummy!', ['dad', 'watermelon', 'happy']]],
      [['How many oranges?', 'three', ['three', 'one', 'five']], ['What is heavy?', 'watermelon', ['watermelon', 'cherries', 'grapes']], ['Who helps?', 'dad', ['dad', 'baby', 'grandma']]]),
    k('leo', 'clothes', 2, 'Leo and the Snowy Day', 'Leo ve karlı gün', [['It is snowy. Leo wants to play outside.', ['snowy', 'boy']], ['Brr! It is cold! Leo runs back in.', ['cold', 'boy'], { n: 'Brr! It is cold!' }], ['He puts on his coat. Brr! Still cold!', ['coat']],
      ['He puts on his boots and gloves. Still cold!', ['boots', 'gloves'], { t: ['What does Leo need now?', 'hat', ['hat', 'shorts', 'sandals']] }], ['He puts on his hat and scarf. Warm at last!', ['hat', 'scarf'], { d: 'scarf' }], ['Leo makes a big snowman.', ['boy', 'snowman']],
      ['The snowman is cold too. Here is my scarf!', ['snowman', 'scarf', 'happy']]],
      [['What is the weather?', 'snowy', ['snowy', 'sunny', 'rainy']], ['What does Leo put on first?', 'coat', ['coat', 'hat', 'boots']], ['Who gets the scarf?', 'snowman', ['snowman', 'dog', 'dad']]]),
    k('kedi', 'home', 2, 'Kitty Wants to Sleep', 'Kedicik uyumak istiyor', [['Kitty is sleepy. She wants a quiet place.', ['cat', 'sleepy']], ['She tries the sofa. The TV is too loud!', ['sofa', 'tv']], ['She tries the kitchen. The fridge goes hum!', ['kitchen', 'fridge']],
      ['She tries the bath. Drip, drip! Too wet!', ['bath'], { t: ['Where does Kitty sleep?', 'bed', ['bed', 'table', 'stairs']] }], ['Too loud! Too wet! Where can I sleep?', ['cat', 'sad'], { n: 'Where can I sleep?' }], ['Then she sees a soft, warm bed.', ['bed'], { d: 'bed' }],
      ['Shh! Kitty is sleeping. Good night!', ['cat', 'bed', 'moon']]],
      [['Who is sleepy?', 'cat', ['cat', 'dog', 'baby']], ['What is too loud?', 'tv', ['tv', 'lamp', 'door']], ['Where does Kitty sleep?', 'bed', ['bed', 'sofa', 'bath']]]),
    k('ilkgun', 'school', 2, 'My First Day', 'İlk günüm', [['Today is my first day at school. I am scared.', ['bag', 'scared']], ['My teacher smiles. Hello! Come in!', ['teacher']], ['I have no pencil. Oh no!', ['pencil', 'sad'], { t: ['Who helps me?', 'girl', ['girl', 'dog', 'baby']] }],
      ['A girl says: Here you are!', ['girl', 'pencil'], { n: 'Here you are!' }], ['She has no eraser. I say: Here you are!', ['eraser', 'girl']], ['We draw a big picture together.', ['crayons', 'paper'], { d: 'crayons' }],
      ['Now I have a friend. I love school!', ['friend', 'happy']]],
      [['How do I feel first?', 'scared', ['scared', 'angry', 'sleepy']], ['What does the girl give me?', 'pencil', ['pencil', 'book', 'ruler']], ['What do I give her?', 'eraser', ['eraser', 'bag', 'glue']]]),
    k('yagmur', 'weather', 2, 'The Lost Umbrella', 'Kayıp şemsiye', [['It is rainy. Duck has a red umbrella.', ['rainy', 'duck', 'umbrella']], ['Whoosh! The wind takes the umbrella!', ['windy', 'umbrella']], ['Come back, umbrella! Come back!', ['duck', 'sad'], { n: 'Come back, umbrella!' }],
      ['It flies over a puddle. Duck jumps. Splash!', ['puddle', 'duck']], ['It flies up to a cloud. Too high!', ['cloud', 'umbrella'], { t: ['What comes after the rain?', 'sunny', ['sunny', 'snowy', 'foggy']] }], ['Then the sun comes out. The wind stops.', ['sun'], { d: 'sun' }],
      ['The umbrella comes down. Look, a rainbow!', ['umbrella', 'rainbow', 'happy']]],
      [['Who has an umbrella?', 'duck', ['duck', 'frog', 'cat']], ['What takes the umbrella?', 'windy', ['windy', 'snowy', 'sunny']], ['What is in the sky at the end?', 'rainbow', ['rainbow', 'moon', 'snowman']]]),
    k('aslan', 'feelings', 2, 'Little Lion Is Angry', 'Küçük Aslan kızgın', [['Little Lion builds a tall tower.', ['lion', 'blocks']], ['Crash! The tower falls down.', ['blocks', 'surprised']], ['Little Lion is angry. Grr!', ['lion', 'angry'], { n: 'Grr! I am angry!' }],
      ['Then he is sad. He cries.', ['sad'], { t: ['Who helps Little Lion?', 'mum', ['mum', 'snake', 'shark']] }], ['Mum says: Breathe in, breathe out.', ['mum', 'calm']], ['Little Lion is calm now. He tries again.', ['lion', 'blocks'], { d: 'blocks' }],
      ['Look! A new tower! He is proud.', ['blocks', 'proud']]],
      [['What falls down?', 'blocks', ['blocks', 'ball', 'kite']], ['How does Little Lion feel first?', 'angry', ['angry', 'happy', 'sleepy']], ['How does he feel at the end?', 'proud', ['proud', 'scared', 'sad']]]),
    k('dede', 'transport', 2, 'Grandpa Is Late', 'Dede gecikti', [['Grandpa has a birthday cake for me.', ['grandpa', 'cake']], ['He takes the bus. But the bus stops!', ['bus', 'sad']], ['Hurry, Grandpa, hurry!', ['grandpa'], { n: 'Hurry, Grandpa, hurry!' }],
      ['He takes a taxi. But there are too many cars!', ['taxi', 'car']], ['He sees a bike. Ring, ring!', ['bike'], { t: ['How does Grandpa come?', 'bike', ['bike', 'rocket', 'ship']] }], ['Grandpa rides fast. Whee!', ['grandpa', 'bike'], { d: 'bike' }],
      ['He is here! Happy birthday to me!', ['grandpa', 'cake', 'happy']]],
      [['What does Grandpa take first?', 'bus', ['bus', 'plane', 'taxi']], ['What has Grandpa got?', 'cake', ['cake', 'ball', 'book']], ['How does he come at the end?', 'bike', ['bike', 'truck', 'rocket']]]),
    k('sekilkent', 'shapes', 2, 'The Sad Little Square', 'Üzgün küçük kare', [['Square is sad. He can\'t roll like Circle.', ['square', 'sad']], ['Circle rolls down the hill. Whee!', ['circle']], ['Square tries. Bump! I can\'t roll!', ['square'], { n: 'I can\'t roll!' }],
      ['Triangle says: You are strong. Help us!', ['triangle'], { t: ['What is the roof?', 'triangle', ['triangle', 'circle', 'heart']] }], ['Square is the walls. Triangle is the roof.', ['square', 'triangle'], { d: 'triangle' }], ['Circle is the sun. Star shines at night.', ['circle', 'star']],
      ['Look! A house! Square is happy now.', ['square', 'triangle', 'happy']]],
      [['Who is sad?', 'square', ['square', 'circle', 'star']], ['Who can roll?', 'circle', ['circle', 'triangle', 'square']], ['What is the roof?', 'triangle', ['triangle', 'heart', 'oval']]]),
    k('ollie', 'sea', 2, 'Ollie and the Lost Shell', 'Ollie ve kayıp kabuk', [['Crab is crying. He lost his shell.', ['crab', 'sad']], ['Ollie the octopus says: I can help!', ['octopus'], { n: 'I can help!' }], ['They ask the turtle. No shell here.', ['turtle']],
      ['They ask the starfish. No shell here.', ['starfish'], { t: ['Who is coming?', 'shark', ['shark', 'cow', 'hen']] }], ['Oh no! A big shark! Hide!', ['shark', 'scared']], ['But the shark has the shell. Is this yours?', ['shark', 'shell'], { d: 'shell' }],
      ['Thank you, Shark! Now we are friends.', ['crab', 'shell', 'happy']]],
      [['Who lost his shell?', 'crab', ['crab', 'turtle', 'dolphin']], ['Who helps Crab?', 'octopus', ['octopus', 'whale', 'starfish']], ['Who has the shell?', 'shark', ['shark', 'turtle', 'fish']]]),
    k('buyuyunce', 'jobs', 3, 'The Kitten in the Tree', 'Ağaçtaki kedi', [['A little kitten is up in a tall tree.', ['cat', 'scared']], ['Meow! Help! I can\'t come down!', ['cat'], { n: 'Help! I can\'t come down!' }], ['The chef comes. Here, kitten! Some fish!', ['chef', 'fish']],
      ['But the kitten is too scared to move.', ['cat', 'scared']], ['The doctor comes. Don\'t worry, kitten!', ['doctor'], { t: ['Who can climb up?', 'firefighter', ['firefighter', 'teacher', 'pilot']] }], ['The firefighter comes with a long ladder.', ['firefighter'], { d: 'firefighter' }],
      ['Up, up, up! He brings the kitten down.', ['firefighter', 'cat']], ['The vet says: She is fine. Everyone claps!', ['vet', 'cat', 'happy']]],
      [['Who is in the tree?', 'cat', ['cat', 'bird', 'monkey']], ['What has the chef got?', 'fish', ['fish', 'cake', 'pizza']], ['Who brings the kitten down?', 'firefighter', ['firefighter', 'doctor', 'chef']]]),
    k('maymun', 'actions', 3, 'Monkey Wants to Fly', 'Maymun uçmak istiyor', [['Monkey sees a bird. I want to fly too!', ['monkey', 'bird']], ['He jumps and jumps. But he can\'t fly.', ['jump', 'monkey']], ['Try again, Monkey! Try again!', ['monkey'], { n: 'Try again, Monkey!' }],
      ['He runs very fast. But he can\'t fly.', ['run']], ['He climbs the tallest tree. But he can\'t fly.', ['climb'], { t: ['What can Monkey do well?', 'climb', ['climb', 'swim', 'read']] }], ['Bird says: I can fly, but I can\'t climb.', ['bird', 'sad']],
      ['Monkey smiles. I can climb! Come on my back!', ['monkey', 'bird'], { d: 'monkey' }], ['Now they play in the tree together.', ['monkey', 'bird', 'happy']]],
      [['Who wants to fly?', 'monkey', ['monkey', 'fish', 'frog']], ['Who can fly?', 'bird', ['bird', 'monkey', 'lion']], ['What can Monkey do well?', 'climb', ['climb', 'swim', 'sing']]]),
    k('agac', 'seasons', 3, 'The Little Seed', 'Küçük tohum', [['A little seed sleeps under the snow. It is winter.', ['winter', 'snowflake']], ['In spring the sun says: Wake up, little seed!', ['spring', 'sun'], { n: 'Wake up, little seed!' }], ['The seed grows a green leaf.', ['leaf']],
      ['The rain comes. The seed drinks and grows.', ['rain'], { t: ['What does the seed become?', 'flower', ['flower', 'pumpkin', 'snowman']] }], ['In summer it is a tall yellow flower.', ['summer', 'flower'], { d: 'flower' }], ['A bee comes to say hello. Buzz!', ['bee', 'flower']],
      ['In autumn the wind blows. New seeds fly away.', ['autumn', 'wind']], ['Winter comes again. Sleep well, little seeds!', ['winter', 'sleepy']]],
      [['When does the seed wake up?', 'spring', ['spring', 'winter', 'autumn']], ['What does the seed become?', 'flower', ['flower', 'leaf', 'nest']], ['Who says hello to the flower?', 'bee', ['bee', 'bird', 'frog']]]),
    k('tavsan', 'days', 3, 'Bunny\'s Carrot Cake', 'Tavşanın havuçlu keki', [['On Monday Bunny plants a carrot seed.', ['monday', 'rabbit']], ['On Tuesday the rain gives it water.', ['tuesday', 'rain']], ['Is it ready? Not yet, Bunny!', ['rabbit'], { n: 'Not yet, Bunny!' }],
      ['On Wednesday a little leaf comes out.', ['wednesday', 'leaf']], ['On Thursday it is sunny. The carrot grows.', ['thursday', 'sunny'], { t: ['What does Bunny make?', 'cake', ['cake', 'pizza', 'soup']] }], ['On Friday Bunny pulls. Pop! A big carrot!', ['friday', 'carrot'], { d: 'carrot' }],
      ['On Saturday she makes a carrot cake.', ['saturday', 'cake']], ['On Sunday all her friends eat cake. Yummy!', ['sunday', 'cake', 'happy']]],
      [['When does Bunny plant the seed?', 'monday', ['monday', 'saturday', 'friday']], ['What grows?', 'carrot', ['carrot', 'apple', 'corn']], ['When do the friends eat cake?', 'sunday', ['sunday', 'tuesday', 'monday']]]),
    k('saklambac', 'places', 3, 'Hide and Seek', 'Saklambaç', [['Let\'s play hide and seek! Puppy counts to ten.', ['dog', 'ten']], ['Ready or not, here I come!', ['dog'], { n: 'Ready or not, here I come!' }], ['Is Kitten under the table? No.', ['under', 'table']],
      ['Is Kitten behind the door? No.', ['behind', 'door']], ['Is Kitten in the bag? No.', ['in', 'bag'], { t: ['Where is Kitten?', 'bed', ['bed', 'fridge', 'bath']] }], ['Puppy is sad. I can\'t find her!', ['dog', 'sad']],
      ['Then he hears a sound. Meow! On the bed!', ['bed', 'cat'], { d: 'cat' }], ['Found you! Now it\'s your turn, Kitten!', ['dog', 'cat', 'happy']]],
      [['Who counts to ten?', 'dog', ['dog', 'cat', 'bird']], ['Where does Puppy look first?', 'under', ['under', 'in', 'behind']], ['Where is Kitten?', 'bed', ['bed', 'sofa', 'bath']]]),
    k('abc', 'alphabet', 3, 'The Lost Letter', 'Kayıp harf', [['A, B and C are friends. They make words.', ['harf-a', 'harf-b', 'harf-c']], ['One day C is not here. Oh no!', ['harf-a', 'harf-b', 'sad']], ['Where are you, C?', ['harf-c'], { n: 'Where are you, C?' }],
      ['A looks under the apple. No C.', ['harf-a', 'apple']], ['B looks behind the ball. No C.', ['harf-b', 'ball'], { t: ['Who is C with?', 'cat', ['cat', 'dog', 'duck']] }], ['They hear a sound. Meow!', ['cat'], { d: 'cat' }],
      ['C is with the cat! C is for cat!', ['harf-c', 'cat']], ['Now they make a word: C, A, B. Cab!', ['harf-c', 'harf-a', 'harf-b', 'taxi']]],
      [['Who is lost?', 'harf-c', ['harf-c', 'harf-a', 'harf-b']], ['Where does A look?', 'apple', ['apple', 'ball', 'egg']], ['Who is C with?', 'cat', ['cat', 'dog', 'cow']]])
  ];
  var SV = { minik: 1, kasif: 2, yildiz: 3 }, SVAD = { 1: 'Minikler', 2: 'Kâşifler', 3: 'Yıldızlar' };
  /* yaş dünyasının kitapları: kendi seviyesi ve altı (yıldızlar hepsini görür) */
  function kitaplar(bant) { var s = SV[bant] || 3; return LISTE.filter(function (b) { return b.sv <= s; }).sort(function (a, b) { return b.sv - a.sv; }); }
  function ingilizce(id) { var x = V.ogeBul ? V.ogeBul(id) : null; return x ? x.en : id; }
  function dokunCumle(id) { return 'Touch the ' + ingilizce(id) + '!'; }
  /* resim: tema çizimi, renk lekesi, sayı kartı ya da simge */
  function gorsel(id) {
    if (W.KIDS_HAYVAN && W.KIDS_HAYVAN.var(id)) return W.KIDS_HAYVAN.ciz(id);
    if (R.var(id)) return R.ciz(id);
    var renk = V.RENK.filter(function (x) { return x.id === id; })[0]; if (renk) return C.leke(renk.hex);
    var sayi = V.SAYI.filter(function (x) { return x.id === id; })[0]; if (sayi) return C.sayiKart(sayi.n, sayi.hex);
    return C.simge(id);
  }
  function kelimeler(s) { return s.split(' ').map(function (w) { return w.toLowerCase().replace(/[^a-z']/g, ''); }).filter(Boolean); }

  /* ---------------- arayüz ---------------- */
  var S = null;
  function kitaplik(o) {
    S = o; SES.sus();
    var il = o.il(), okunan = il.kitap || {}, L = kitaplar(o.bant), benim = SV[o.bant] || 3;
    o.kok.innerHTML = '<div class="ka-dunya" aria-hidden="true">' + R.dunya('family') + '</div><header class="ka-konu-ust"><button type="button" class="ka-yuvarlak" data-kgeri aria-label="Haritaya dön">' + C.simge('ev') + '</button><h1 class="kk-bas">' + C.simge('book') + ' Kitaplık</h1><span></span></header>' +
      '<main class="ka-sahne kk-raf"><p class="kk-alt">Bir kitap seç. Acadia sana okusun; kelimelere dokun, sonunda soruları cevapla. <b>' + L.filter(function (b) { return okunan[b.id]; }).length + ' / ' + L.length + '</b> kitap okudun.</p><ul class="kk-kitaplar">' +
      L.map(function (b, i) { var kz = V.konuBul(b.konu); return '<li><button type="button" class="kk-kapak' + (b.sv === benim ? ' kk-benim' : '') + (okunan[b.id] ? ' kk-okundu' : '') + '" data-kitap="' + b.id + '" style="--r:' + kz.renk + ';--i:' + (i % 8) + '"><span class="kk-res">' + gorsel(b.sayfalar[0].r[0]) + '</span><b lang="en">' + esc(b.ad) + '</b><small>' + esc(b.tr) + '</small><em class="kk-sv kk-sv' + b.sv + '">' + (b.sv === benim ? 'Senin için' : 'Kolay') + ' · ' + b.sayfalar.length + ' sayfa</em>' + (okunan[b.id] ? '<i class="ka-tik">' + C.simge('tik') + '</i>' : '') + '</button></li>'; }).join('') + '</ul></main>';
    o.kok.dataset.gorunum = 'kitap';
    o.kok.querySelector('[data-kgeri]').addEventListener('click', function () { SES.fx('dokun'); SES.sus(); o.geri(); });
    o.kok.querySelectorAll('[data-kitap]').forEach(function (b) { b.addEventListener('click', function () { SES.fx('dokun'); ac(b.getAttribute('data-kitap'), 0); }); });
    SES.soyle('Kitaplığa hoş geldin! Bir kitap seç.', 'tr');
  }
  function ac(id, n) {
    var b = LISTE.filter(function (x) { return x.id === id; })[0], o = S, kz = V.konuBul(b.konu), son = n >= b.sayfalar.length, iptal = false;
    SES.sus(); o.kok.scrollTo && W.scrollTo(0, 0);
    var nokta = '<ol class="kk-noktalar">' + b.sayfalar.map(function (x, i) { return '<li class="' + (i === n ? 'kk-bu' : i < n ? 'kk-gecti' : '') + '"></li>'; }).join('') + '<li class="' + (son ? 'kk-bu' : '') + '">?</li></ol>';
    var ust = '<div class="ka-dunya" aria-hidden="true">' + R.dunya(b.konu) + '</div><header class="ka-konu-ust"><button type="button" class="ka-yuvarlak" data-kraf aria-label="Kitaplığa dön">' + C.simge('book') + '</button>' + nokta + '<button type="button" class="ka-yuvarlak" data-koku aria-label="Yeniden oku">' + C.simge('ses') + '</button></header>';
    if (son) return sorular(b, 0, 0, ust);
    var sf = b.sayfalar[n], bas = 0;
    var cumle = sf.s.split(' ').map(function (w) { var h = '<button type="button" class="kk-k" data-kk="' + esc(w.toLowerCase().replace(/[^a-z']/g, '')) + '" data-bas="' + bas + '">' + esc(w) + '</button>'; bas += w.length + 1; return h; }).join(' ');
    o.kok.innerHTML = ust + '<main class="ka-sahne kk-sayfa" style="--r:' + kz.renk + '"><h2 class="kk-ad" lang="en">' + esc(b.ad) + '</h2><div class="kk-resim kk-r' + sf.r.length + '">' + sf.r.map(function (r, i) { return '<button type="button" class="kk-rb" data-kr="' + r + '" style="--i:' + i + '" aria-label="' + esc(ingilizce(r)) + '">' + gorsel(r) + '</button>'; }).join('') + '<span class="kk-acd">' + C.acadia({ mood: 'mutlu' }) + '</span></div>' +
      '<p class="kk-cumle" lang="en">' + cumle + '</p><p class="kk-katil" data-katil hidden></p><div class="kk-alt-d"><button type="button" class="ka-orta" data-konce' + (n ? '' : ' disabled') + '>‹ Önceki</button><button type="button" class="ka-buyuk" data-ksonra>' + (n === b.sayfalar.length - 1 ? 'Sorular' : 'Sonraki') + ' ' + C.simge('oynat') + '</button></div></main>';
    o.kok.dataset.gorunum = 'kitap';
    var ks = [].slice.call(o.kok.querySelectorAll('.kk-k'));
    function oku() {
      ks.forEach(function (x) { x.classList.remove('kk-yanan'); });
      var zaman = null, j = 0, sinirGeldi = false;
      zaman = setInterval(function () { if (!sinirGeldi && j < ks.length) { ks.forEach(function (x, m) { x.classList.toggle('kk-yanan', m === j); }); j++; } }, 380);
      return SES.soyle(sf.s, 'en', { hiz: 0.9, sinir: function (ci) { sinirGeldi = true; ks.forEach(function (x) { x.classList.toggle('kk-yanan', +x.getAttribute('data-bas') <= ci && ci < +x.getAttribute('data-bas') + x.textContent.length + 1); }); } })
        .then(function () { clearInterval(zaman); ks.forEach(function (x) { x.classList.remove('kk-yanan'); }); });
    }
    ks.forEach(function (x) { x.addEventListener('click', function () { SES.sus(); SES.fx('dokun'); x.classList.remove('kk-zipla'); void x.offsetWidth; x.classList.add('kk-zipla'); SES.soyle(x.getAttribute('data-kk'), 'en'); }); });
    o.kok.querySelector('[data-koku]').addEventListener('click', function () { SES.sus(); oku(); });
    o.kok.querySelector('[data-kraf]').addEventListener('click', function () { iptal = true; SES.sus(); SES.fx('dokun'); kitaplik(o); });
    /* katılım: nakaratı birlikte söyle, sayfada bir şeye dokun; sayfa çevrilirken tahmin sorusu */
    var katil = o.kok.querySelector('[data-katil]'), dokunBek = false;
    function katilim() {
      if (iptal) return;
      var zincir = Promise.resolve();
      if (sf.n) zincir = zincir.then(function () { if (iptal) return; katil.hidden = false; katil.className = 'kk-katil kk-nakarat'; katil.innerHTML = C.simge('mikrofon') + ' <b>Birlikte söyleyelim:</b> <span lang="en">' + esc(sf.n) + '</span>'; return SES.soyle('Say it with me!', 'en').then(function () { return iptal ? 0 : SES.soyle(sf.n, 'en', { hiz: 0.85 }); }).then(function () { return new Promise(function (r) { setTimeout(r, iptal ? 0 : 1800); }); }); });
      if (sf.d) zincir = zincir.then(function () { if (iptal) return; dokunBek = true; katil.hidden = false; katil.className = 'kk-katil kk-dokun'; katil.innerHTML = '☝ <span lang="en">' + esc(dokunCumle(sf.d)) + '</span>'; o.kok.querySelector('.kk-resim').classList.add('kk-sec'); return SES.soyle(dokunCumle(sf.d), 'en'); });
      return zincir;
    }
    o.kok.querySelectorAll('[data-kr]').forEach(function (rb) {
      rb.addEventListener('click', function () {
        var rid = rb.getAttribute('data-kr'); rb.classList.remove('kk-zipla'); void rb.offsetWidth; rb.classList.add('kk-zipla');
        if (dokunBek && rid === sf.d) { dokunBek = false; SES.sus(); SES.fx('dogru'); rb.classList.add('kk-buldu'); o.kok.querySelector('.kk-resim').classList.remove('kk-sec'); katil.innerHTML = '★ <span lang="en">Well done!</span>'; SES.soyle('Well done!', 'en'); return; }
        if (dokunBek) { SES.fx('yanlis'); return; }
        SES.sus(); SES.fx('dokun'); var hs = W.KIDS_KONUSAN && W.KIDS_KONUSAN.hayvanSesi({ id: rid }); (hs && SES.hayvan ? SES.hayvan(hs) : Promise.resolve()).then(function () { if (!iptal) SES.soyle(ingilizce(rid), 'en'); });
      });
    });
    function tahmin() {
      var q = sf.t, sec = q.y.slice().sort(function () { return Math.random() - 0.5; });
      SES.sus(); katil.hidden = true;
      var kt = D.createElement('div'); kt.className = 'kk-tahmin'; kt.innerHTML = '<div class="kk-tahmin-ic"><p class="kk-tahmin-ust">' + C.acadia({ mood: 'dusun' }) + '<b>Sence?</b></p><h2 lang="en">' + esc(q.s) + '</h2><div class="ko-kartlar2">' + sec.map(function (x) { return '<button type="button" class="ko-kart2" data-tc="' + x + '">' + gorsel(x) + '</button>'; }).join('') + '</div></div>';
      o.kok.querySelector('main').appendChild(kt); SES.soyle(q.s, 'en');
      kt.querySelectorAll('[data-tc]').forEach(function (bt) { bt.addEventListener('click', function () { if (iptal) return; iptal = true; var dogru = bt.getAttribute('data-tc') === q.c; SES.sus(); SES.fx(dogru ? 'dogru' : 'dokun'); bt.classList.add(dogru ? 'ko-dogru' : 'kk-belki'); SES.soyle(dogru ? 'Yes! Let\'s see!' : 'Hmm! Let\'s see!', 'en').then(function () { ac(id, n + 1); }); }); });
    }
    o.kok.querySelector('[data-ksonra]').addEventListener('click', function () { if (iptal) return; SES.fx('dokun'); if (sf.t && !o.kok.querySelector('.kk-tahmin')) return tahmin(); iptal = true; ac(id, n + 1); });
    o.kok.querySelector('[data-konce]').addEventListener('click', function () { iptal = true; SES.fx('dokun'); ac(id, n - 1); });
    setTimeout(function () { if (!iptal) oku().then(katilim); }, 300);
  }
  function sorular(b, i, dogruSay, ust) {
    var o = S, q = b.sorular[i];
    if (!q) return bitir(b, dogruSay, ust);
    var sec = q.y.slice().sort(function () { return Math.random() - 0.5; });
    o.kok.innerHTML = ust + '<main class="ka-sahne kk-soru"><p class="kk-soru-no">Soru ' + (i + 1) + ' / ' + b.sorular.length + '</p><h2 class="kk-soru-s" lang="en"><button type="button" class="ko-dinle" data-ksor aria-label="Soruyu dinle">' + C.simge('ses') + '</button>' + esc(q.s) + '</h2>' +
      '<div class="ko-kartlar2">' + sec.map(function (x) { return '<button type="button" class="ko-kart2" data-kcev="' + x + '">' + gorsel(x) + '</button>'; }).join('') + '</div></main>';
    var ilk = true, sor = function () { return SES.soyle(q.s, 'en'); };
    o.kok.querySelector('[data-ksor]').addEventListener('click', function () { SES.fx('dokun'); sor(); });
    o.kok.querySelector('[data-kraf]').addEventListener('click', function () { SES.sus(); kitaplik(o); });
    o.kok.querySelector('[data-koku]').addEventListener('click', function () { SES.sus(); sor(); });
    o.kok.querySelectorAll('[data-kcev]').forEach(function (bt) {
      bt.addEventListener('click', function () {
        if (bt.getAttribute('data-kcev') === q.c) { SES.fx('dogru'); bt.classList.add('ko-dogru'); var y = ilk ? 1 : 0; SES.soyle(['Well done!', 'Super!'][i % 2], 'en').then(function () { sorular(b, i + 1, dogruSay + y, ust); }); }
        else { ilk = false; SES.fx('yanlis'); bt.classList.remove('ko-salla'); void bt.offsetWidth; bt.classList.add('ko-salla'); sor(); }
      });
    });
    sor();
  }
  function bitir(b, dogru, ust) {
    var o = S, il = o.il(); il.kitap = il.kitap || {}; il.kitap[b.id] = Date.now(); o.kaydet(il);
    o.kok.innerHTML = ust.replace(/data-kraf/, 'data-kraf') + '<main class="ka-sahne ka-bitis kk-bitti"><div class="ka-konfeti" aria-hidden="true">' + new Array(20).join('<i></i>') + '</div><div class="ka-ara-acd">' + C.acadia({ mood: 'kutlama' }) + '</div><h1><span lang="en">' + esc(b.ad) + '</span></h1><p>Kitabı bitirdin! İlk denemede <b>' + dogru + ' / ' + b.sorular.length + '</b> soruyu bildin.</p>' +
      '<div class="ka-izle-alt"><button type="button" class="ka-orta" data-kyine>Yeniden oku</button><button type="button" class="ka-buyuk" data-kraf2 data-odak>Kitaplık ' + C.simge('book') + '</button></div></main>';
    /* en sevdiğin sayfa: çocuk hikâyeye dönüp bir an seçer */
    var sev = D.createElement('div'); sev.className = 'kk-sev'; sev.innerHTML = '<p><b>En sevdiğin sayfa hangisi?</b></p><div class="kk-sev-l">' + b.sayfalar.map(function (x, i) { return '<button type="button" data-sev="' + i + '"' + ((il.kitapSev || {})[b.id] === i ? ' class="kk-sevdi"' : '') + ' aria-label="Sayfa ' + (i + 1) + '">' + gorsel(x.r[0]) + '<i>♥</i></button>'; }).join('') + '</div>';
    o.kok.querySelector('.kk-bitti .ka-izle-alt').before(sev);
    sev.querySelectorAll('[data-sev]').forEach(function (bt) { bt.addEventListener('click', function () { var l = o.il(); l.kitapSev = l.kitapSev || {}; l.kitapSev[b.id] = +bt.getAttribute('data-sev'); o.kaydet(l); sev.querySelectorAll('[data-sev]').forEach(function (z) { z.classList.toggle('kk-sevdi', z === bt); }); SES.fx('dogru'); SES.soyle('I like it too!', 'en'); }); });
    SES.fx('yildiz'); SES.soyle('The end! Great reading!', 'en');
    o.kok.querySelector('[data-kraf]').addEventListener('click', function () { kitaplik(o); });
    o.kok.querySelector('[data-kraf2]').addEventListener('click', function () { SES.fx('dokun'); kitaplik(o); });
    o.kok.querySelector('[data-koku]').addEventListener('click', function () { SES.soyle('The end! Great reading!', 'en'); });
    o.kok.querySelector('[data-kyine]').addEventListener('click', function () { ac(b.id, 0); });
  }
  W.KIDS_KITAP = { kitaplar: kitaplar, dokunCumle: dokunCumle, SV: SV, LISTE: LISTE, kitaplik: kitaplik, ac: function (id) { ac(id, 0); }, gorsel: gorsel, kelimeler: kelimeler };
})(window);
