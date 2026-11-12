/* ==========================================================================
   ACADEX KIDS · hikâye kitaplığı (kids/assets/kids-kitap.js), 12.11.2026
   Her konuya bir resimli, sesli mini hikâye (5 sayfa) ve sonunda 3 resimli soru.
   Sayfa açılınca Acadia okur, okunan kelime yanar; kelimeye dokununca o kelime okunur.
   Hikâyeler Acadex için yazıldı; resimler kids-resim çizimlerinden kurulur.
   Okunan kitap çocuğun ilerlemesine (il.kitap) işlenir; kitaplıkta ✓ görünür.
   Kaynak: KIDS_KITAP.LISTE (katalog bu listeden seslendirir). W.KIDS_KITAP
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, C = W.KIDS_CIZ, R = W.KIDS_RESIM, V = W.KIDS_VERI, SES = W.KIDS_SES;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function k(id, konu, ad, tr, sayfa, soru) { return { id: id, konu: konu, ad: ad, tr: tr, sayfalar: sayfa.map(function (x) { return { s: x[0], r: x[1] }; }), sorular: soru.map(function (x) { return { s: x[0], c: x[1], y: x[2] }; }) }; }
  var LISTE = [
    k('boya', 'colours', 'The Rainbow Paint', 'Gökkuşağı boyası', [['Ada has a paint box.', ['girl', 'paints']], ['She paints a red apple.', ['apple']], ['She paints a yellow sun and a blue ship.', ['sunny', 'ship']], ['She paints a green frog.', ['frog']], ['Look! A rainbow!', ['rainbow', 'girl']]],
      [['What colour is the apple?', 'red', ['red', 'blue', 'green']], ['What does Ada paint first?', 'apple', ['apple', 'frog', 'sunny']], ['What is green?', 'frog', ['frog', 'apple', 'sun']]]),
    k('yildizlar', 'numbers', 'Ten Little Stars', 'On küçük yıldız', [['One star, two stars, three stars in the sky.', ['star', 'star', 'star']], ['A little bird counts the stars.', ['bird', 'star']], ['Four, five, six! The moon says hello.', ['ay', 'star']], ['Seven, eight, nine, ten! So many stars!', ['star', 'star', 'star']], ['Good night, stars!', ['sleep']]],
      [['Who counts the stars?', 'bird', ['bird', 'cat', 'fish']], ['How many stars? Ten!', 'ten', ['ten', 'two', 'five']], ['Who says hello?', 'ay', ['ay', 'sun', 'car']]]),
    k('ciftlik', 'animals', 'Who Is Hiding?', 'Kim saklanıyor?', [['Tom goes to the farm.', ['boy', 'tractor']], ['Moo! A cow is hiding.', ['cow']], ['Quack! A duck is in the water.', ['duck']], ['Oink! A pig is in the mud.', ['pig']], ['Woof! It\'s my dog! Hello, dog!', ['dog', 'boy']]],
      [['Who says moo?', 'cow', ['cow', 'pig', 'duck']], ['Who is in the water?', 'duck', ['duck', 'dog', 'cow']], ['Who says woof?', 'dog', ['dog', 'cat', 'pig']]]),
    k('dogumgunu', 'family', 'Grandma\'s Birthday', 'Büyükannenin doğum günü', [['It\'s Grandma\'s birthday today.', ['grandma', 'cake']], ['Mum makes a big cake.', ['mum', 'cake']], ['Dad and the baby have a present.', ['dad', 'baby', 'hediye']], ['My sister sings a song.', ['sister', 'sing']], ['Grandma is very happy!', ['grandma', 'happy']]],
      [['Whose birthday is it?', 'grandma', ['grandma', 'dad', 'baby']], ['What does Mum make?', 'cake', ['cake', 'pizza', 'soup']], ['Who sings a song?', 'sister', ['sister', 'brother', 'dad']]]),
    k('freddy', 'body', 'Freddy the Monster', 'Canavar Freddy', [['This is Freddy. He is a friendly monster.', ['puppet']], ['He has three eyes!', ['eyes', 'eyes']], ['He has two big ears.', ['ears']], ['He has a small nose and a big mouth.', ['nose', 'mouth']], ['Freddy waves his hands. Hello!', ['puppet', 'hands']]],
      [['How many eyes has Freddy got?', 'three', ['three', 'two', 'one']], ['What does Freddy wave?', 'hands', ['hands', 'feet', 'ears']], ['What is small?', 'nose', ['nose', 'mouth', 'ears']]]),
    k('ayi', 'food', 'The Hungry Bear', 'Aç ayı', [['Bear is hungry.', ['bear', 'hungry']], ['He eats an apple. Yum!', ['bear', 'apple']], ['He eats bread and cheese.', ['bread', 'cheese']], ['He drinks milk.', ['milk']], ['Now he is not hungry. He is happy!', ['bear', 'happy']]],
      [['Who is hungry?', 'bear', ['bear', 'cat', 'cow']], ['What does Bear drink?', 'milk', ['milk', 'juice', 'soup']], ['What does he eat first?', 'apple', ['apple', 'cake', 'egg']]]),
    k('ayicik', 'toys', 'Where Is My Teddy?', 'Ayıcığım nerede?', [['Mia can\'t find her teddy.', ['girl', 'teddy']], ['Is it in the toy box? No, it\'s a car.', ['car']], ['Is it under the bed? No, it\'s a ball.', ['bed', 'ball']], ['Is it on the chair? No, it\'s a doll.', ['chair', 'doll']], ['It\'s in her bag! Hello, teddy!', ['bag', 'teddy']]],
      [['What can\'t Mia find?', 'teddy', ['teddy', 'robot', 'kite']], ['What is under the bed?', 'ball', ['ball', 'car', 'doll']], ['Where is the teddy?', 'bag', ['bag', 'bed', 'chair']]]),
    k('leo', 'clothes', 'Get Dressed, Leo!', 'Giyin Leo!', [['It\'s cold today, Leo.', ['cold', 'boy']], ['Put on your coat.', ['coat']], ['Put on your hat and your scarf.', ['hat', 'scarf']], ['Put on your gloves and your boots.', ['gloves', 'boots']], ['Now let\'s play in the snow!', ['snowman', 'boy']]],
      [['Is it hot or cold?', 'cold', ['cold', 'hot', 'sunny']], ['What goes on Leo\'s head?', 'hat', ['hat', 'boots', 'gloves']], ['Where does Leo play?', 'snow', ['snow', 'rain', 'sun']]]),
    k('kedi', 'home', 'Kitty\'s House', 'Kedinin evi', [['Kitty the cat lives in a house.', ['cat', 'ev']], ['She sleeps on the bed.', ['bed', 'cat']], ['She sits on the sofa.', ['sofa', 'cat']], ['She looks in the mirror. Who is that?', ['mirror', 'cat']], ['It\'s Kitty! Meow!', ['cat']]],
      [['Where does Kitty sleep?', 'bed', ['bed', 'sofa', 'bath']], ['What does Kitty look in?', 'mirror', ['mirror', 'window', 'door']], ['Who says meow?', 'cat', ['cat', 'dog', 'cow']]]),
    k('ilkgun', 'school', 'My First Day', 'İlk günüm', [['Today is my first day at school.', ['nervous', 'bag']], ['I have a new bag.', ['bag']], ['In my bag I have a pencil and a book.', ['pencil', 'book']], ['My teacher says hello. I say hello!', ['teacher', 'board']], ['I make a new friend. School is fun!', ['friend', 'happy']]],
      [['What is new?', 'bag', ['bag', 'hat', 'ball']], ['Who says hello?', 'teacher', ['teacher', 'doctor', 'chef']], ['What is in the bag?', 'pencil', ['pencil', 'cake', 'kite']]]),
    k('yagmur', 'weather', 'Rain, Rain, Sun!', 'Yağmur, yağmur, güneş!', [['Look outside. It\'s rainy.', ['rainy']], ['I have my umbrella and my boots.', ['umbrella', 'boots']], ['I jump in a big puddle. Splash!', ['puddle', 'jump']], ['Now it\'s sunny!', ['sunny']], ['Look! A rainbow!', ['rainbow']]],
      [['What is the weather first?', 'rainy', ['rainy', 'snowy', 'sunny']], ['Where do I jump?', 'puddle', ['puddle', 'bed', 'sofa']], ['What do I see at the end?', 'rainbow', ['rainbow', 'snowman', 'star']]]),
    k('aslan', 'feelings', 'Little Lion\'s Day', 'Küçük aslanın günü', [['In the morning Little Lion is sleepy.', ['lion', 'sleepy']], ['He can\'t find his ball. He is sad.', ['lion', 'sad']], ['A bird finds the ball! Lion is surprised.', ['bird', 'ball', 'surprised']], ['They play together. Lion is happy!', ['lion', 'bird', 'happy']], ['At night he is tired. Good night, Little Lion!', ['lion', 'sleep']]],
      [['What can\'t Lion find?', 'ball', ['ball', 'kite', 'car']], ['Who finds the ball?', 'bird', ['bird', 'fish', 'cow']], ['How does Lion feel when they play?', 'happy', ['happy', 'angry', 'sad']]]),
    k('pazar', 'fruits', 'The Fruit Market', 'Meyve pazarı', [['Let\'s go to the fruit market!', ['bag', 'orangefruit']], ['I buy three oranges.', ['orangefruit', 'orangefruit', 'orangefruit']], ['Mum buys grapes and a big watermelon.', ['grapes', 'watermelon']], ['The lemon is sour! Yuck!', ['lemon', 'silly']], ['We make a fruit salad. Yummy!', ['kiwi', 'pear', 'cherries']]],
      [['How many oranges do I buy?', 'three', ['three', 'one', 'five']], ['What is big?', 'watermelon', ['watermelon', 'cherries', 'grapes']], ['What is sour?', 'lemon', ['lemon', 'peach', 'mango']]]),
    k('dede', 'transport', 'Grandpa\'s Trip', 'Dedenin yolculuğu', [['Grandpa goes to see his friend.', ['grandpa']], ['First he takes a bus. Beep, beep!', ['bus']], ['Then he takes a train.', ['train']], ['Then he takes a ship. Toot, toot!', ['ship']], ['His friend is waiting with a bike. Ring, ring!', ['man', 'bike']]],
      [['What does Grandpa take first?', 'bus', ['bus', 'plane', 'taxi']], ['What goes toot, toot?', 'ship', ['ship', 'car', 'bike']], ['What has the friend got?', 'bike', ['bike', 'rocket', 'truck']]]),
    k('sekilkent', 'shapes', 'Shape Town', 'Şekil Kasabası', [['Welcome to Shape Town!', ['square', 'triangle']], ['The houses are squares.', ['square', 'square']], ['The roofs are triangles.', ['triangle', 'triangle']], ['The sun is a big circle.', ['circle', 'sun']], ['At night the sky is full of stars.', ['star', 'star', 'star']]],
      [['What shape are the houses?', 'square', ['square', 'circle', 'star']], ['What shape is the sun?', 'circle', ['circle', 'triangle', 'heart']], ['What is in the sky at night?', 'star', ['star', 'square', 'oval']]]),
    k('ollie', 'sea', 'Ollie the Octopus', 'Ahtapot Ollie', [['Ollie the octopus lives in the sea.', ['octopus']], ['He has eight long arms.', ['octopus']], ['He plays with a crab and a fish.', ['crab', 'fish']], ['Oh no! A shark! Ollie hides in a shell.', ['shark', 'shell']], ['The shark is friendly. Let\'s play!', ['shark', 'octopus', 'happy']]],
      [['Who is Ollie?', 'octopus', ['octopus', 'turtle', 'dolphin']], ['How many arms has Ollie got?', 'eight', ['eight', 'two', 'four']], ['Where does Ollie hide?', 'shell', ['shell', 'crab', 'starfish']]]),
    k('buyuyunce', 'jobs', 'When I Grow Up', 'Büyüyünce', [['What do you want to be?', ['boy', 'girl']], ['I want to be a doctor. I help people.', ['doctor']], ['I want to be a chef. I cook pizza.', ['chef', 'pizza']], ['I want to be a pilot. I fly a plane!', ['pilot', 'plane']], ['And you? You can be anything!', ['star']]],
      [['Who helps people?', 'doctor', ['doctor', 'chef', 'pilot']], ['What does the chef cook?', 'pizza', ['pizza', 'soup', 'cake']], ['What does the pilot fly?', 'plane', ['plane', 'kite', 'bus']]]),
    k('maymun', 'actions', 'Monkey Can!', 'Maymun yapabilir!', [['Monkey can climb a tree.', ['monkey', 'climb']], ['Frog can jump. Jump, jump!', ['frog', 'jump']], ['Fish can swim.', ['fish', 'swim']], ['Bird can sing.', ['bird', 'sing']], ['And I can dance! Look at me!', ['dance']]],
      [['Who can climb?', 'monkey', ['monkey', 'fish', 'frog']], ['What can Fish do?', 'swim', ['swim', 'sing', 'climb']], ['What can I do?', 'dance', ['dance', 'sleep', 'read']]]),
    k('agac', 'seasons', 'The Tree\'s Year', 'Ağacın bir yılı', [['In spring the tree has flowers.', ['spring']], ['In summer children play under the tree.', ['summer', 'boy']], ['In autumn the leaves are orange.', ['autumn', 'yaprak']], ['In winter there is snow on the tree.', ['winter']], ['Then spring comes again!', ['spring', 'happy']]],
      [['When does the tree have flowers?', 'spring', ['spring', 'winter', 'autumn']], ['What colour are the leaves in autumn?', 'orange', ['orange', 'blue', 'purple']], ['When is there snow?', 'winter', ['winter', 'summer', 'spring']]]),
    k('tavsan', 'days', 'Busy Bunny', 'Meşgul Tavşan', [['On Monday Bunny goes to school.', ['rabbit', 'bag']], ['On Tuesday Bunny paints.', ['rabbit', 'paints']], ['On Wednesday Bunny swims.', ['swim']], ['On Thursday and Friday Bunny reads.', ['read']], ['On Saturday and Sunday Bunny plays with friends!', ['rabbit', 'friend']]],
      [['When does Bunny paint?', 'tuesday', ['tuesday', 'monday', 'sunday']], ['What does Bunny do on Wednesday?', 'swim', ['swim', 'read', 'sing']], ['When does Bunny go to school?', 'monday', ['monday', 'saturday', 'friday']]]),
    k('saklambac', 'places', 'Where Is Kitten?', 'Kedicik nerede?', [['Kitten likes to hide.', ['cat']], ['Is she in the box? Yes!', ['in', 'cat']], ['Now she is under the table.', ['under', 'cat']], ['Now she is behind the box.', ['behind']], ['Now she is on my bed. Got you!', ['bed', 'cat']]],
      [['Who likes to hide?', 'cat', ['cat', 'dog', 'bird']], ['Where is she first?', 'in', ['in', 'under', 'behind']], ['Where is she at the end?', 'bed', ['bed', 'sofa', 'bath']]]),
    k('abc', 'alphabet', 'A Is for Apple', 'A, Apple gibi', [['A is for apple. Crunch!', ['harf-a', 'apple']], ['B is for ball. Bounce!', ['harf-b', 'ball']], ['C is for cat. Meow!', ['harf-c', 'cat']], ['D is for dog. Woof!', ['harf-d', 'dog']], ['E is for egg. What comes next? F!', ['harf-e', 'harf-f']]],
      [['What is A for?', 'apple', ['apple', 'ball', 'egg']], ['C is for…?', 'cat', ['cat', 'dog', 'cow']], ['What comes after E?', 'harf-f', ['harf-f', 'harf-a', 'harf-z']]])
  ];
  /* resim: tema çizimi, renk lekesi, sayı kartı ya da simge */
  function gorsel(id) {
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
    var il = o.il(), okunan = il.kitap || {};
    o.kok.innerHTML = '<div class="ka-dunya" aria-hidden="true">' + R.dunya('family') + '</div><header class="ka-konu-ust"><button type="button" class="ka-yuvarlak" data-kgeri aria-label="Haritaya dön">' + C.simge('ev') + '</button><h1 class="kk-bas">' + C.simge('book') + ' Kitaplık</h1><span></span></header>' +
      '<main class="ka-sahne kk-raf"><p class="kk-alt">Bir kitap seç. Acadia sana okusun; kelimelere dokun, sonunda soruları cevapla. <b>' + Object.keys(okunan).length + ' / ' + LISTE.length + '</b> kitap okudun.</p><ul class="kk-kitaplar">' +
      LISTE.map(function (b, i) { var kz = V.konuBul(b.konu); return '<li><button type="button" class="kk-kapak' + (okunan[b.id] ? ' kk-okundu' : '') + '" data-kitap="' + b.id + '" style="--r:' + kz.renk + ';--i:' + (i % 8) + '"><span class="kk-res">' + gorsel(b.sayfalar[0].r[0]) + '</span><b lang="en">' + esc(b.ad) + '</b><small>' + esc(b.tr) + '</small>' + (okunan[b.id] ? '<i class="ka-tik">' + C.simge('tik') + '</i>' : '') + '</button></li>'; }).join('') + '</ul></main>';
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
    o.kok.innerHTML = ust + '<main class="ka-sahne kk-sayfa" style="--r:' + kz.renk + '"><h2 class="kk-ad" lang="en">' + esc(b.ad) + '</h2><div class="kk-resim kk-r' + sf.r.length + '">' + sf.r.map(function (r, i) { return '<span style="--i:' + i + '">' + gorsel(r) + '</span>'; }).join('') + '<span class="kk-acd">' + C.acadia({ mood: 'mutlu' }) + '</span></div>' +
      '<p class="kk-cumle" lang="en">' + cumle + '</p><div class="kk-alt-d"><button type="button" class="ka-orta" data-konce' + (n ? '' : ' disabled') + '>‹ Önceki</button><button type="button" class="ka-buyuk" data-ksonra>' + (n === b.sayfalar.length - 1 ? 'Sorular' : 'Sonraki') + ' ' + C.simge('oynat') + '</button></div></main>';
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
    o.kok.querySelector('[data-ksonra]').addEventListener('click', function () { iptal = true; SES.fx('dokun'); ac(id, n + 1); });
    o.kok.querySelector('[data-konce]').addEventListener('click', function () { iptal = true; SES.fx('dokun'); ac(id, n - 1); });
    setTimeout(function () { if (!iptal) oku(); }, 300);
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
    SES.fx('yildiz'); SES.soyle('The end! Great reading!', 'en');
    o.kok.querySelector('[data-kraf]').addEventListener('click', function () { kitaplik(o); });
    o.kok.querySelector('[data-kraf2]').addEventListener('click', function () { SES.fx('dokun'); kitaplik(o); });
    o.kok.querySelector('[data-koku]').addEventListener('click', function () { SES.soyle('The end! Great reading!', 'en'); });
    o.kok.querySelector('[data-kyine]').addEventListener('click', function () { ac(b.id, 0); });
  }
  W.KIDS_KITAP = { LISTE: LISTE, kitaplik: kitaplik, ac: function (id) { ac(id, 0); }, gorsel: gorsel, kelimeler: kelimeler };
})(window);
