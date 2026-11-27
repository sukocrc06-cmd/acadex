/* ==========================================================================
   ACADEX KIDS · ZAMAN MAKİNESİ KASABASI: KONU VERİSİ (kids/assets/kids-gramer2.js), 27.11.2026
   İlkokul İngilizce dil bilgisi, kolaydan zora 30 konu. Seviye = sınıf:
     Kolay (2. sınıf) ~ Cambridge Pre A1 Starters · Orta (3. sınıf) ~ A1 Movers · Zor (4. sınıf) ~ A2 Flyers başı.
   Sıra MEB Maarif Modeli İngilizce kalıplarıyla (Target Language Chunks) uyumlu: önce olmak, sahiplik,
   yer; sonra geniş/şimdiki zaman; en son geçmiş ve gelecek.
   Her konu üç adım: İZLE (animasyonlu anlatım) → DENE (boşluğa bloğu sürükle) → OYNA (6 soruluk oyun).
   Biçim:
     iz  [{ t: Türkçe anlatım, s: cümle, ... }]   s: "She/s is/v happy/o ."  kelime/rol, _ = tek blokta boşluk
         rol: s kim (mavi) · v ne yapar (kırmızı) · o ne/nerede (yeşil) · q soru (mor) · x diğer (gri)
         "play+s/v"  kök + ek: ek uçarak köke yapışır · "go>went/v" dönüşüm: kelime değişir
         z: 'dun' | 'simdi' | 'yarin' | 'her'  → zaman treni o istasyona gider
         r: resim (KIDS_RESIM) · tab: [[sol, sağ]…] eşleşme tablosu · b: [kelime…] büyüyen nesneler
     de  [boşluklu cümle, doğru, [yanlışlar], Türkçesi]                   (5 tane)
     oy  "s|cümle|doğru|yanlış,yanlış|Türkçe"  seç
         "y|cümle|1 ya da 0|doğrusu|Türkçe"     doğru mu yanlış mı
         "d|kelime/rol …|Türkçe"                 kelimeleri sırala
   ========================================================================== */
(function (W) {
  'use strict';
  function k(id, sv, en, tr, renk, ikon, iz, de, oy, zaman) { return { id: id, sv: sv, en: en, tr: tr, renk: renk, ikon: ikon, iz: iz, de: de, oy: oy, zaman: zaman || '' }; }
  var KONU = [
    /* =================== KOLAY · 2. sınıf =================== */
    k('k-be', 2, 'am / is / are', 'Olmak', '#4AA8FF', 'be', [
      { t: '"Olmak" kelimesi İngilizcede kişiye göre değişir. Ben için "am" deriz.', s: 'I/s am/v happy/o .', r: 'happy' },
      { t: 'O (kız), o (erkek) ve o (şey) için "is" deriz.', s: 'She/s is/v my_teacher/o .', r: 'teacher' },
      { t: 'Sen, biz ve onlar için "are" deriz.', s: 'We/s are/v friends/o .', r: 'friend' },
      { t: 'Hepsini bir arada görelim.', s: 'It/s is/v a_cat/o .', tab: [['I', 'am'], ['He · She · It', 'is'], ['You · We · They', 'are']], r: 'cat' }
    ], [['I ___ seven.', 'am', ['is', 'are'], 'Ben yedi yaşındayım.'], ['He ___ my brother.', 'is', ['am', 'are'], 'O benim kardeşim.'], ['They ___ happy.', 'are', ['is', 'am'], 'Onlar mutlu.'],
      ['It ___ a dog.', 'is', ['are', 'am'], 'O bir köpek.'], ['You ___ my friend.', 'are', ['am', 'is'], 'Sen benim arkadaşımsın.']],
    ['s|She ___ hungry.|is|am,are|O aç.', 's|We ___ in the garden.|are|is,am|Biz bahçedeyiz.', 'y|I is happy.|0|I am happy.|Ben mutluyum.', 'y|They are at school.|1||Onlar okulda.',
      'd|He/s is/v tall/o .|O uzun boylu.', 's|___ am eight.|I|She,They|Ben sekiz yaşındayım.']),
    k('k-aan', 2, 'a / an', 'Bir', '#FF9E57', 'aan', [
      { t: 'Bir tane şeyden söz ederken kelimenin önüne "a" koyarız.', s: 'It/s is/v a_ball/o .', r: 'ball' },
      { t: 'Kelime a, e, i, o, u sesiyle başlıyorsa "an" deriz. Söylemesi kolay olsun diye.', s: 'It/s is/v an_apple/o .', r: 'apple' },
      { t: 'Elephant "e" sesiyle başlıyor; o yüzden "an elephant".', s: 'It/s is/v an_elephant/o .', r: 'elephant' },
      { t: 'Book "b" sesiyle başlıyor; "a book".', s: 'I/s have_got/v a_book/o .', r: 'book', tab: [['a', 'ball · cat · book'], ['an', 'apple · egg · umbrella']] }
    ], [['It is ___ egg.', 'an', ['a'], 'Bu bir yumurta.'], ['It is ___ dog.', 'a', ['an'], 'Bu bir köpek.'], ['I have got ___ umbrella.', 'an', ['a'], 'Bir şemsiyem var.'],
      ['She has got ___ bike.', 'a', ['an'], 'Onun bir bisikleti var.'], ['It is ___ orange.', 'an', ['a'], 'Bu bir portakal.']],
    ['s|It is ___ apple.|an|a|Bu bir elma.', 's|It is ___ car.|a|an|Bu bir araba.', 'y|It is a egg.|0|It is an egg.|Bu bir yumurta.', 'y|It is a cat.|1||Bu bir kedi.',
      'd|It/s is/v an/x elephant/o .|Bu bir fil.', 's|I want ___ banana.|a|an|Bir muz istiyorum.']),
    k('k-cogul', 2, 'cat → cats', 'Çoğul: -s', '#4CC38A', 'cogul', [
      { t: 'Bir tane kedi: a cat.', s: 'It/s is/v a_cat/o .', r: 'cat' },
      { t: 'Birden fazla olunca kelimenin sonuna "s" ekleriz. İzle, s geliyor!', s: 'two/x cat+s/o', r: 'cat' },
      { t: 'Kitaplar da öyle: book, books.', s: 'three/x book+s/o', r: 'book' },
      { t: 'Box gibi kelimelere "es" gelir: boxes.', s: 'two/x box+es/o' },
      { t: 'Bazı kelimeler kuralı bozar! Bir çocuk "child", çocuklar "children".', s: 'two/x child>children/o', r: 'children' }
    ], [['two ___', 'dogs', ['dog', 'a dog'], 'iki köpek'], ['three ___', 'apples', ['apple', 'an apple'], 'üç elma'], ['a ___', 'pencil', ['pencils', 'pencilss'], 'bir kalem'],
      ['five ___', 'boxes', ['boxs', 'box'], 'beş kutu'], ['four ___', 'children', ['childs', 'child'], 'dört çocuk']],
    ['s|six ___|cats|cat,a cat|altı kedi', 's|one ___|ball|balls,ballses|bir top', 'y|two book|0|two books|iki kitap', 'y|three birds|1||üç kuş',
      'd|I/s have_got/v two/x pencils/o .|İki kalemim var.', 's|two ___|children|childs,childrens|iki çocuk']),
    k('k-this', 2, 'this / that', 'Bu / Şu', '#B57BFF', 'this', [
      { t: 'Yakınımızdaki şeyi gösterirken "this" deriz: bu.', s: 'This/s is/v my_bag/o .', r: 'bag' },
      { t: 'Uzaktaki şeyi gösterirken "that" deriz: şu.', s: 'That/s is/v a_bird/o .', r: 'bird' },
      { t: 'Birden fazla yakın şey için "these", uzak şeyler için "those".', s: 'These/s are/v my_books/o .', r: 'book', tab: [['yakın', 'this · these'], ['uzak', 'that · those']] },
      { t: 'Soru da sorabiliriz: Bu ne?', s: 'What/q is/v this/s ?' }
    ], [['___ is my pencil. (yakın)', 'This', ['That', 'These'], 'Bu benim kalemim.'], ['___ is a plane. (uzak)', 'That', ['This', 'Those'], 'Şu bir uçak.'],
      ['___ are my shoes. (yakın)', 'These', ['This', 'Those'], 'Bunlar benim ayakkabılarım.'], ['___ are birds. (uzak)', 'Those', ['These', 'That'], 'Şunlar kuş.'], ['What is ___? (yakın)', 'this', ['these', 'those'], 'Bu ne?']],
    ['s|___ is my cat. (yakın)|This|These,Those|Bu benim kedim.', 's|___ is the sun. (uzak)|That|This,These|Şu güneş.', 'y|These is my book.|0|This is my book.|Bu benim kitabım.', 'y|Those are stars.|1||Şunlar yıldız.',
      'd|What/q is/v that/s ?|Şu ne?', 's|___ are my friends. (yakın)|These|This,That|Bunlar benim arkadaşlarım.']),
    k('k-my', 2, 'my / your / his / her', 'Benim, senin...', '#FF6B9A', 'my', [
      { t: 'Bir şey bizimse "my" deriz: benim.', s: 'This/s is/v my/x bag/o .', r: 'bag' },
      { t: 'Karşımızdakininse "your": senin.', s: 'Is/q this/s your/x pencil/o ?', r: 'pencil' },
      { t: 'Bir erkeğinse "his", bir kızınsa "her".', s: 'His/x name/s is/v Can/o .', tab: [['I', 'my'], ['you', 'your'], ['he', 'his'], ['she', 'her'], ['we', 'our'], ['they', 'their']] },
      { t: 'Kızın şapkası: her hat.', s: 'Her/x hat/s is/v red/o .', r: 'hat' }
    ], [['I have got a dog. ___ dog is big.', 'My', ['Your', 'Her'], 'Benim köpeğim büyük.'], ['Ayşe is my friend. ___ eyes are blue.', 'Her', ['His', 'My'], 'Onun gözleri mavi.'],
      ['Ali is here. ___ bag is red.', 'His', ['Her', 'Your'], 'Onun çantası kırmızı.'], ['Is this ___ book? (sen)', 'your', ['my', 'his'], 'Bu senin kitabın mı?'], ['We love ___ school.', 'our', ['their', 'your'], 'Okulumuzu seviyoruz.']],
    ['s|She is Elif. ___ name is Elif.|Her|His,My|Onun adı Elif.', 's|He is Can. ___ name is Can.|His|Her,Your|Onun adı Can.', 'y|I love my mum.|1||Annemi seviyorum.', 'y|Ali and his sister: her name is Ece.|1||Kız kardeşinin adı Ece.',
      'd|This/s is/v my/x teddy/o .|Bu benim oyuncak ayım.', 's|They are in ___ garden.|their|our,her|Onlar bahçelerinde.']),
    k('k-have', 2, 'have got / has got', 'Sahip olmak', '#2FB7B0', 'have', [
      { t: 'Bir şeyimiz olduğunu söylerken "have got" deriz.', s: 'I/s have_got/v a_cat/o .', r: 'cat' },
      { t: 'O (kız, erkek, şey) için "has got" olur.', s: 'She/s has_got/v a_kite/o .', r: 'kite' },
      { t: 'Olmayan şey için "haven\'t got" ya da "hasn\'t got".', s: 'He/s hasn\'t_got/v a_bike/o .', r: 'bike', tab: [['I · you · we · they', 'have got'], ['he · she · it', 'has got']] },
      { t: 'Soru sorarken başa alırız: Have you got...?', s: 'Have/q you/s got/v a_pen/o ?' }
    ], [['I ___ two brothers.', 'have got', ['has got', 'is'], 'İki erkek kardeşim var.'], ['She ___ long hair.', 'has got', ['have got', 'are'], 'Onun uzun saçı var.'], ['We ___ a big house.', 'have got', ['has got', 'am'], 'Büyük bir evimiz var.'],
      ['___ you got a pet?', 'Have', ['Has', 'Are'], 'Evcil hayvanın var mı?'], ['The dog ___ a ball.', 'has got', ['have got', 'are'], 'Köpeğin bir topu var.']],
    ['s|He ___ a robot.|has got|have got,am|Onun bir robotu var.', 's|They ___ a car.|have got|has got,is|Onların bir arabası var.', 'y|She have got a doll.|0|She has got a doll.|Onun bir bebeği var.', 'y|I have got blue eyes.|1||Mavi gözlerim var.',
      'd|Have/q you/s got/v a/x ruler/o ?|Cetvelin var mı?', 's|It ___ four legs.|has got|have got,are|Onun dört bacağı var.']),
    k('k-can', 2, 'can / can\'t', 'Yapabilmek', '#FFC233', 'can', [
      { t: 'Yapabildiğimiz şeyler için "can" deriz.', s: 'I/s can/v swim/v .', r: 'swim' },
      { t: '"Can" herkes için aynıdır, hiç değişmez!', s: 'She/s can/v dance/v .', r: 'dance' },
      { t: 'Yapamadığımız şeyler için "can\'t".', s: 'A_fish/s can\'t/v climb/v .', r: 'fish' },
      { t: 'İzin isterken de kullanırız: ...-ebilir miyim?', s: 'Can/q I/s open/v the_window/o ?', r: 'window' }
    ], [['Birds ___ fly.', 'can', ['can\'t', 'are'], 'Kuşlar uçabilir.'], ['A cat ___ read.', 'can\'t', ['can', 'is'], 'Kedi okuyamaz.'], ['___ I go out, please?', 'Can', ['Am', 'Is'], 'Dışarı çıkabilir miyim?'],
      ['He can ___ fast.', 'run', ['runs', 'running'], 'O hızlı koşabilir.'], ['Fish ___ swim.', 'can', ['can\'t', 'has'], 'Balıklar yüzebilir.']],
    ['s|She can ___ the piano.|play|plays,playing|Piyano çalabilir.', 's|A dog ___ talk.|can\'t|can,is|Köpek konuşamaz.', 'y|He cans jump.|0|He can jump.|O zıplayabilir.', 'y|I can draw a cat.|1||Kedi çizebilirim.',
      'd|Can/q you/s sing/v ?|Şarkı söyleyebilir misin?', 's|Monkeys ___ climb trees.|can|can\'t,are|Maymunlar ağaca tırmanabilir.']),
    k('k-emir', 2, 'Sit down! Don\'t run!', 'Emir cümleleri', '#FF6B5B', 'emir', [
      { t: 'Birinden bir şey yapmasını isterken fiille başlarız.', s: 'Sit/v down/o !', r: 'chair' },
      { t: 'Kibar olmak için "please" ekleriz.', s: 'Open/v the_door,/o please/x !', r: 'door' },
      { t: 'Yapmamasını isterken başa "Don\'t" koyarız.', s: 'Don\'t/v run/v !', r: 'run' },
      { t: 'Birlikte bir şey yapalım derken "Let\'s".', s: 'Let\'s/v play/v !', r: 'ball' }
    ], [['___ your book, please.', 'Open', ['Opens', 'Opening'], 'Kitabını aç lütfen.'], ['___ shout! (yapma)', 'Don\'t', ['Not', 'No'], 'Bağırma!'], ['___ play football!', 'Let\'s', ['Lets', 'Let'], 'Hadi futbol oynayalım!'],
      ['Stand ___!', 'up', ['down', 'in'], 'Ayağa kalk!'], ['Don\'t ___ in the classroom.', 'eat', ['eats', 'eating'], 'Sınıfta yemek yeme.']],
    ['s|___ down, please.|Sit|Sits,Sitting|Otur lütfen.', 's|___ touch it!|Don\'t|Not,No|Ona dokunma!', 'y|Close the window, please.|1||Pencereyi kapat lütfen.', 'y|Don\'t runs!|0|Don\'t run!|Koşma!',
      'd|Let\'s/v sing/v a_song/o !|Hadi bir şarkı söyleyelim!', 's|___ your hands!|Wash|Washes,Washing|Ellerini yıka!']),
    k('k-yer', 2, 'in / on / under / next to', 'Nerede?', '#8BC34A', 'yer', [
      { t: 'Bir şeyin içindeyse "in".', s: 'The_ball/s is/v in/o the_box/o .', yer: 'in', r: 'in' },
      { t: 'Üstündeyse "on".', s: 'The_ball/s is/v on/o the_box/o .', yer: 'on', r: 'on' },
      { t: 'Altındaysa "under".', s: 'The_ball/s is/v under/o the_box/o .', yer: 'under', r: 'under' },
      { t: 'Yanındaysa "next to".', s: 'The_ball/s is/v next_to/o the_box/o .', yer: 'next', r: 'next' }
    ], [['The cat is ___ the bed. (altında)', 'under', ['on', 'in'], 'Kedi yatağın altında.'], ['The book is ___ the table. (üstünde)', 'on', ['under', 'in'], 'Kitap masanın üstünde.'],
      ['The fish is ___ the water. (içinde)', 'in', ['on', 'under'], 'Balık suyun içinde.'], ['The lamp is ___ the bed. (yanında)', 'next to', ['under', 'in'], 'Lamba yatağın yanında.'], ['My pencil is ___ my bag. (içinde)', 'in', ['on', 'next to'], 'Kalemim çantamın içinde.']],
    ['s|The bird is ___ the tree. (üstünde)|on|under,in|Kuş ağacın üstünde.', 's|The dog is ___ the table. (altında)|under|on,in|Köpek masanın altında.', 'y|The milk is in the fridge.|1||Süt buzdolabının içinde.', 'y|The hat is in my head.|0|The hat is on my head.|Şapka başımın üstünde.',
      'd|Where/q is/v the_cat/s ?|Kedi nerede?', 's|Sit ___ me. (yanımda)|next to|in,under|Yanıma otur.']),
    k('k-soru', 2, 'what / who / where / how many', 'Soru kelimeleri', '#7E8CFF', 'soru', [
      { t: 'Bir şeyi sorarken "what": ne?', s: 'What/q is/v your_name/s ?' },
      { t: 'Bir kişiyi sorarken "who": kim?', s: 'Who/q is/v she/s ?', r: 'girl' },
      { t: 'Bir yeri sorarken "where": nerede?', s: 'Where/q is/v my_bag/s ?', r: 'bag' },
      { t: 'Sayıyı sorarken "how many": kaç tane?', s: 'How_many/q cats/o are_there/v ?', r: 'cat', tab: [['ne?', 'what'], ['kim?', 'who'], ['nerede?', 'where'], ['kaç tane?', 'how many'], ['kaç yaşında?', 'how old']] }
    ], [['___ is your teacher? (kim)', 'Who', ['What', 'Where'], 'Öğretmenin kim?'], ['___ is the cat? (nerede)', 'Where', ['Who', 'What'], 'Kedi nerede?'], ['___ colour is it? (ne)', 'What', ['Who', 'Where'], 'O ne renk?'],
      ['___ pencils have you got? (kaç)', 'How many', ['What', 'Who'], 'Kaç kalemin var?'], ['___ are you? (kaç yaşında)', 'How old', ['How many', 'Where'], 'Kaç yaşındasın?']],
    ['s|___ is that boy? He is my brother.|Who|What,Where|O çocuk kim? O benim kardeşim.', 's|___ is my book? It is on the table.|Where|Who,What|Kitabım nerede? Masanın üstünde.', 'y|What is your name?|1||Adın ne?', 'y|Who is the ball? It is red.|0|What colour is the ball? It is red.|Top ne renk? Kırmızı.',
      'd|Where/q is/v the_dog/s ?|Köpek nerede?', 's|___ apples? Three apples.|How many|What,Who|Kaç elma? Üç elma.']),

    /* =================== ORTA · 3. sınıf =================== */
    k('o-genis', 3, 'I play / She plays', 'Geniş zaman', '#4AA8FF', 'saat', [
      { t: 'Her gün, her zaman yaptığımız şeyleri geniş zamanla anlatırız.', s: 'I/s play/v football/o every_day/x .', z: 'her', r: 'ball' },
      { t: 'O (kız, erkek, şey) için fiilin sonuna "s" gelir. İzle!', s: 'She/s play+s/v football/o .', z: 'her' },
      { t: 'Bazı fiillere "es" gelir: go → goes, watch → watches.', s: 'He/s go+es/v to_school/o .', z: 'her', r: 'bus' },
      { t: 'Ben, sen, biz, onlar için ek yok.', s: 'They/s eat/v breakfast/o .', z: 'her', tab: [['I · you · we · they', 'play'], ['he · she · it', 'plays']] }
    ], [['My mum ___ tea every morning.', 'drinks', ['drink', 'drinking'], 'Annem her sabah çay içer.'], ['I ___ to school by bus.', 'go', ['goes', 'going'], 'Okula otobüsle giderim.'], ['The cat ___ a lot.', 'sleeps', ['sleep', 'sleeping'], 'Kedi çok uyur.'],
      ['We ___ English on Monday.', 'have', ['has', 'having'], 'Pazartesi İngilizce dersimiz var.'], ['He ___ TV after school.', 'watches', ['watchs', 'watch'], 'Okuldan sonra televizyon izler.']],
    ['s|She ___ to music.|listens|listen,listening|O müzik dinler.', 's|They ___ in the park.|play|plays,playing|Onlar parkta oynar.', 'y|He like apples.|0|He likes apples.|O elmaları sever.', 'y|My dad works in a hospital.|1||Babam hastanede çalışır.',
      'd|She/s reads/v a_book/o every_night/x .|O her gece kitap okur.', 's|The sun ___ in the morning.|rises|rise,rising|Güneş sabah doğar.'], 'her'),
    k('o-simdiki', 3, 'I am playing', 'Şimdiki zaman', '#FF6B5B', 'simdi', [
      { t: 'Şu anda, tam şimdi yaptığımız şeyi şimdiki zamanla anlatırız.', s: 'I/s am/v play+ing/v now/x .', z: 'simdi', r: 'ball' },
      { t: 'Önce am, is ya da are; sonra fiilin sonuna "ing".', s: 'She/s is/v read+ing/v .', z: 'simdi', r: 'read' },
      { t: 'Onlar şu anda yüzüyor.', s: 'They/s are/v swim+ming/v .', z: 'simdi', r: 'swim' },
      { t: 'Soru: Ne yapıyorsun?', s: 'What/q are/v you/s do+ing/v ?', z: 'simdi' }
    ], [['Look! The baby ___ sleeping.', 'is', ['are', 'am'], 'Bak! Bebek uyuyor.'], ['We are ___ a cake now.', 'making', ['make', 'makes'], 'Şimdi kek yapıyoruz.'], ['I am ___ a picture.', 'drawing', ['draw', 'draws'], 'Resim çiziyorum.'],
      ['The children ___ singing.', 'are', ['is', 'am'], 'Çocuklar şarkı söylüyor.'], ['He is ___ his teeth.', 'brushing', ['brush', 'brushes'], 'Dişlerini fırçalıyor.']],
    ['s|Listen! She ___ singing.|is|are,am|Dinle! O şarkı söylüyor.', 's|They are ___ football now.|playing|play,plays|Şu anda futbol oynuyorlar.', 'y|I am eating an apple now.|1||Şu anda elma yiyorum.', 'y|He running now.|0|He is running now.|O şimdi koşuyor.',
      'd|The_dog/s is/v jumping/v .|Köpek zıplıyor.', 's|What ___ you doing?|are|is,am|Ne yapıyorsun?'], 'simdi'),
    k('o-there', 3, 'there is / there are', '...var', '#4CC38A', 'there', [
      { t: 'Bir yerde bir şey var demek için "there is" deriz.', s: 'There_is/v a_cat/o in_the_garden/o .', r: 'cat' },
      { t: 'Birden fazlaysa "there are".', s: 'There_are/v three_birds/o on_the_tree/o .', r: 'bird' },
      { t: 'Yoksa "there isn\'t" ya da "there aren\'t".', s: 'There_isn\'t/v a_TV/o in_my_room/o .', tab: [['bir tane', 'there is'], ['birden çok', 'there are']] },
      { t: 'Sorarken: Is there...? Are there...?', s: 'Is_there/q a_park/o near_here/x ?' }
    ], [['___ a lamp on the desk.', 'There is', ['There are', 'They are'], 'Masada bir lamba var.'], ['___ five apples in the bag.', 'There are', ['There is', 'It is'], 'Çantada beş elma var.'], ['___ a library at school?', 'Is there', ['Are there', 'There is'], 'Okulda kütüphane var mı?'],
      ['There ___ two beds in my room.', 'are', ['is', 'am'], 'Odamda iki yatak var.'], ['There ___ a dog under the table.', 'is', ['are', 'am'], 'Masanın altında bir köpek var.']],
    ['s|___ a clock on the wall.|There is|There are,They are|Duvarda bir saat var.', 's|There ___ many stars in the sky.|are|is,am|Gökyüzünde çok yıldız var.', 'y|There are a cat on the bed.|0|There is a cat on the bed.|Yatakta bir kedi var.', 'y|There are two windows.|1||İki pencere var.',
      'd|Is_there/q a/x pool/o ?|Havuz var mı?', 's|___ any milk? Yes, there is.|Is there|Are there,There is|Süt var mı? Evet var.']),
    k('o-some', 3, 'some / any', 'Biraz, hiç', '#FFC233', 'some', [
      { t: 'Olumlu cümlede "some" deriz: biraz, birkaç.', s: 'I/s have_got/v some/x apples/o .', r: 'apple' },
      { t: 'Soru sorarken "any" deriz.', s: 'Have/q you/s got/v any/x milk/o ?', r: 'milk' },
      { t: 'Olumsuz cümlede de "any": hiç.', s: 'There_isn\'t/v any/x bread/o .', r: 'bread', tab: [['olumlu', 'some'], ['soru', 'any'], ['olumsuz', 'any']] },
      { t: 'Bir şey isterken kibarca "some" kullanırız.', s: 'Can/q I/s have/v some/x water/o ?' }
    ], [['There are ___ eggs in the fridge.', 'some', ['any', 'a'], 'Buzdolabında birkaç yumurta var.'], ['Have you got ___ sisters?', 'any', ['some', 'a'], 'Kız kardeşin var mı?'], ['I haven\'t got ___ money.', 'any', ['some', 'an'], 'Hiç param yok.'],
      ['Can I have ___ juice, please?', 'some', ['any', 'an'], 'Biraz meyve suyu alabilir miyim?'], ['Are there ___ books on the shelf?', 'any', ['some', 'a'], 'Rafta kitap var mı?']],
    ['s|I want ___ grapes.|some|any,an|Biraz üzüm istiyorum.', 's|There aren\'t ___ cars.|any|some,a|Hiç araba yok.', 'y|Is there any cheese?|1||Peynir var mı?', 'y|I haven\'t got some pens.|0|I haven\'t got any pens.|Hiç kalemim yok.',
      'd|We/s have_got/v some/x cookies/o .|Biraz kurabiyemiz var.', 's|Are there ___ cats in the garden?|any|some,a|Bahçede kedi var mı?']),
    k('o-sifat', 3, 'a big red ball', 'Sıfatlar', '#B57BFF', 'sifat', [
      { t: 'Sıfatlar bir şeyin nasıl olduğunu anlatır: büyük, kırmızı, mutlu.', s: 'It/s is/v a_big/x ball/o .', r: 'ball' },
      { t: 'İngilizcede sıfat, ismin önüne gelir.', s: 'I/s have_got/v a_red/x hat/o .', r: 'hat' },
      { t: 'Sıfat "is" ten sonra da gelebilir.', s: 'The_elephant/s is/v big/x .', r: 'elephant' },
      { t: 'Sıfatlar çoğul olmaz! Kırmızı arabalar: red cars, "reds" yok.', s: 'two/x red/x cars/o', r: 'car' }
    ], [['It is a ___ dog.', 'small', ['smalls', 'dog small'], 'O küçük bir köpek.'], ['The sky is ___.', 'blue', ['blues', 'a blue'], 'Gökyüzü mavi.'], ['I have got ___ shoes.', 'new', ['news', 'a new'], 'Yeni ayakkabılarım var.'],
      ['She is ___.', 'happy', ['a happy', 'happys'], 'O mutlu.'], ['It is a ___ cat.', 'black', ['blacks', 'cat black'], 'O siyah bir kedi.']],
    ['s|It is a ___ car.|fast|fasts,car fast|O hızlı bir araba.', 's|My bag is ___.|heavy|heavys,a heavy|Çantam ağır.', 'y|I have got a cat white.|0|I have got a white cat.|Beyaz bir kedim var.', 'y|They are tall girls.|1||Onlar uzun boylu kızlar.',
      'd|It/s is/v a/x small/x mouse/o .|O küçük bir fare.', 's|The soup is ___.|hot|hots,a hot|Çorba sıcak.']),
    k('o-like', 3, 'I like swimming', 'Sevmek + -ing', '#FF6B9A', 'like', [
      { t: 'Sevdiğimiz bir şeyi söylerken "like" deriz.', s: 'I/s like/v apples/o .', r: 'apple' },
      { t: 'Sevdiğimiz bir eylemse fiile "ing" ekleriz.', s: 'I/s like/v swim+ming/o .', r: 'swim' },
      { t: 'Çok seviyorsak "love", hiç sevmiyorsak "hate".', s: 'She/s love+s/v dance>dancing/o .', r: 'dance' },
      { t: 'Sevmiyorsak "don\'t like".', s: 'I/s don\'t_like/v getting_up_early/o .', tab: [['çok severim', 'love'], ['severim', 'like'], ['sevmem', 'don\'t like'], ['nefret ederim', 'hate']] }
    ], [['I like ___ books.', 'reading', ['read', 'reads'], 'Kitap okumayı severim.'], ['She loves ___.', 'singing', ['sing', 'sings'], 'Şarkı söylemeyi çok sever.'], ['They ___ playing chess.', 'like', ['likes', 'liking'], 'Satranç oynamayı severler.'],
      ['He ___ like swimming.', 'doesn\'t', ['don\'t', 'isn\'t'], 'Yüzmeyi sevmez.'], ['Do you like ___?', 'drawing', ['draw', 'draws'], 'Resim çizmeyi sever misin?']],
    ['s|I love ___ my bike.|riding|ride,rides|Bisiklet sürmeyi çok severim.', 's|My brother ___ cooking.|likes|like,liking|Kardeşim yemek yapmayı sever.', 'y|She likes dance.|0|She likes dancing.|Dans etmeyi sever.', 'y|I hate waiting.|1||Beklemekten nefret ederim.',
      'd|We/s like/v playing/o football/o .|Futbol oynamayı severiz.', 's|Do you like ___?|skating|skate,skates|Paten kaymayı sever misin?']),
    k('o-must', 3, 'must / mustn\'t', 'Kurallar', '#2FB7B0', 'must', [
      { t: 'Bir kurala uymak gerekiyorsa "must" deriz: -meli, -malı.', s: 'You/s must/v wash/v your_hands/o .', r: 'hands' },
      { t: 'Yasaksa "mustn\'t": -memeli, -mamalı.', s: 'You/s mustn\'t/v run/v in_the_corridor/o .', r: 'run' },
      { t: '"Must" herkes için aynı, sonra fiil ek almaz.', s: 'She/s must/v listen/v .', tab: [['yapmalısın', 'must'], ['yapmamalısın', 'mustn\'t']] },
      { t: 'Okul kuralı: Sınıfta yemek yememeliyiz.', s: 'We/s mustn\'t/v eat/v in_class/o .' }
    ], [['You ___ be quiet in the library.', 'must', ['mustn\'t', 'can\'t'], 'Kütüphanede sessiz olmalısın.'], ['You ___ touch the fire!', 'mustn\'t', ['must', 'can'], 'Ateşe dokunmamalısın!'], ['We must ___ the rules.', 'follow', ['follows', 'following'], 'Kurallara uymalıyız.'],
      ['He ___ brush his teeth.', 'must', ['musts', 'mustn\'t'], 'Dişlerini fırçalamalı.'], ['You ___ shout in class.', 'mustn\'t', ['must', 'musts'], 'Sınıfta bağırmamalısın.']],
    ['s|You ___ wear a helmet on a bike.|must|mustn\'t,musts|Bisiklette kask takmalısın.', 's|You ___ throw rubbish.|mustn\'t|must,can|Çöp atmamalısın.', 'y|She musts go to bed.|0|She must go to bed.|Yatmalı.', 'y|We must help each other.|1||Birbirimize yardım etmeliyiz.',
      'd|You/s mustn\'t/v be/v late/o .|Geç kalmamalısın.', 's|Children ___ cross the road alone.|mustn\'t|must,musts|Çocuklar karşıya yalnız geçmemeli.']),
    k('o-iyelik', 3, 'Ali\'s bag', 'Kimin?: \'s', '#FF9E57', 'iyelik', [
      { t: 'Bir şeyin kime ait olduğunu söylemek için isimden sonra "\'s" ekleriz.', s: 'This/s is/v Ali+\'s/x bag/o .', r: 'bag' },
      { t: 'Annemin arabası: my mum\'s car.', s: 'It/s is/v my_mum+\'s/x car/o .', r: 'car' },
      { t: 'Kimin diye sorarken "whose".', s: 'Whose/q pencil/o is/v this/s ?', r: 'pencil' },
      { t: 'Cevap: It\'s Elif\'s. (Elif\'in)', s: 'It/s is/v Elif+\'s/x .' }
    ], [['This is ___ hat. (Can\'in)', 'Can\'s', ['Cans', 'Can'], 'Bu Can\'ın şapkası.'], ['___ book is this?', 'Whose', ['Who', 'What'], 'Bu kimin kitabı?'], ['It is my ___ house. (büyükannemin)', 'grandma\'s', ['grandmas', 'grandma'], 'Büyükannemin evi.'],
      ['The ___ tail is long. (kedinin)', 'cat\'s', ['cats', 'cat'], 'Kedinin kuyruğu uzun.'], ['That is ___ room. (Ece\'nin)', 'Ece\'s', ['Eces', 'Ece'], 'Şu Ece\'nin odası.']],
    ['s|This is my ___ phone. (babamın)|dad\'s|dads,dad|Bu babamın telefonu.', 's|___ shoes are these?|Whose|Who,Where|Bunlar kimin ayakkabıları?', 'y|It is Mert\'s ball.|1||Bu Mert\'in topu.', 'y|This is Ayşe bag.|0|This is Ayşe\'s bag.|Bu Ayşe\'nin çantası.',
      'd|Whose/q coat/o is/v this/s ?|Bu kimin montu?', 's|The ___ name is Max. (köpeğin)|dog\'s|dogs,dog|Köpeğin adı Max.']),
    k('o-zamanedat', 3, 'at 3 o\'clock / on Monday / in May', 'Zamanda at, on, in', '#7E8CFF', 'takvim', [
      { t: 'Saatlerden önce "at".', s: 'I/s get_up/v at/x seven_o\'clock/o .', r: 'clock' },
      { t: 'Günlerden önce "on".', s: 'We/s have/v art/o on/x Monday/o .', r: 'monday' },
      { t: 'Aylar ve mevsimlerden önce "in".', s: 'It/s snows/v in/x winter/o .', r: 'winter' },
      { t: 'Hepsi bir arada.', s: 'My_birthday/s is/v in/x May/o .', tab: [['saat', 'at 3 o\'clock'], ['gün', 'on Friday'], ['ay · mevsim', 'in June · in summer']] }
    ], [['School starts ___ 9 o\'clock.', 'at', ['on', 'in'], 'Okul saat dokuzda başlar.'], ['We go swimming ___ Saturday.', 'on', ['in', 'at'], 'Cumartesi yüzmeye gideriz.'], ['It is hot ___ summer.', 'in', ['on', 'at'], 'Yazın hava sıcak.'],
      ['My birthday is ___ April.', 'in', ['on', 'at'], 'Doğum günüm nisanda.'], ['I have lunch ___ 12 o\'clock.', 'at', ['in', 'on'], 'Saat on ikide öğle yemeği yerim.']],
    ['s|Leaves fall ___ autumn.|in|on,at|Sonbaharda yapraklar düşer.', 's|We have music ___ Tuesday.|on|in,at|Salı günü müzik dersimiz var.', 'y|I go to bed in 9 o\'clock.|0|I go to bed at 9 o\'clock.|Saat dokuzda yatarım.', 'y|It snows in January.|1||Ocakta kar yağar.',
      'd|The_film/s starts/v at/x five/o .|Film beşte başlıyor.', 's|We go to the park ___ Sunday.|on|at,in|Pazar günü parka gideriz.']),
    k('o-siklik', 3, 'always / usually / sometimes / never', 'Ne sıklıkla?', '#8BC34A', 'siklik', [
      { t: 'Bir şeyi ne sıklıkla yaptığımızı bu kelimelerle anlatırız.', s: 'I/s always/x brush/v my_teeth/o .', z: 'her', tab: [['her zaman', 'always'], ['genellikle', 'usually'], ['bazen', 'sometimes'], ['asla', 'never']] },
      { t: 'Bu kelime fiilin önüne gelir.', s: 'She/s usually/x walk+s/v to_school/o .', z: 'her' },
      { t: 'Ama "is, am, are" den sonra gelir.', s: 'He/s is/v never/x late/o .', z: 'her' },
      { t: 'Soru: Ne sıklıkla?', s: 'How_often/q do/v you/s swim/v ?', z: 'her' }
    ], [['I ___ eat breakfast. (her zaman)', 'always', ['never', 'sometimes'], 'Her zaman kahvaltı yaparım.'], ['She ___ plays tennis. (bazen)', 'sometimes', ['always', 'never'], 'Bazen tenis oynar.'], ['We ___ go to school on Sunday. (asla)', 'never', ['always', 'usually'], 'Pazar günü asla okula gitmeyiz.'],
      ['He is ___ happy. (genellikle)', 'usually', ['never', 'always'], 'Genellikle mutludur.'], ['___ do you read? Every day.', 'How often', ['How many', 'What'], 'Ne sıklıkla okursun? Her gün.']],
    ['s|I ___ drink milk. (genellikle)|usually|never,always|Genellikle süt içerim.', 's|Cats ___ fly. (asla)|never|always,usually|Kediler asla uçmaz.', 'y|She always is happy.|0|She is always happy.|O her zaman mutludur.', 'y|We sometimes go to the cinema.|1||Bazen sinemaya gideriz.',
      'd|He/s never/x eats/v fish/o .|O asla balık yemez.', 's|___ do you visit your grandma?|How often|How many,Where|Büyükanneni ne sıklıkla ziyaret edersin?'], 'her'),

    /* =================== ZOR · 4. sınıf =================== */
    k('z-was', 4, 'was / were', 'Geçmişte olmak', '#4AA8FF', 'dun', [
      { t: 'Zaman treni dün istasyonuna gidiyor! Geçmişte "am" ve "is", "was" olur.', s: 'I/s am>was/v happy/o yesterday/x .', z: 'dun' },
      { t: 'O için de "was".', s: 'She/s was/v at_school/o yesterday/x .', z: 'dun' },
      { t: '"are" geçmişte "were" olur.', s: 'They/s are>were/v at_home/o .', z: 'dun', tab: [['am · is', 'was'], ['are', 'were']] },
      { t: 'Olumsuz: wasn\'t, weren\'t.', s: 'It/s wasn\'t/v cold/o yesterday/x .', z: 'dun' }
    ], [['I ___ tired yesterday.', 'was', ['were', 'am'], 'Dün yorgundum.'], ['We ___ in the park last Sunday.', 'were', ['was', 'are'], 'Geçen pazar parktaydık.'], ['The film ___ funny.', 'was', ['were', 'are'], 'Film komikti.'],
      ['___ you at home yesterday?', 'Were', ['Was', 'Are'], 'Dün evde miydin?'], ['They ___ at school. (değildi)', 'weren\'t', ['wasn\'t', 'aren\'t'], 'Okulda değillerdi.']],
    ['s|My grandpa ___ a teacher.|was|were,are|Dedem öğretmendi.', 's|The children ___ happy.|were|was,is|Çocuklar mutluydu.', 'y|She were at the zoo.|0|She was at the zoo.|Hayvanat bahçesindeydi.', 'y|It was sunny yesterday.|1||Dün hava güneşliydi.',
      'd|Where/q were/v you/s ?|Neredeydin?', 's|___ he at the party?|Was|Were,Is|O partide miydi?'], 'dun'),
    k('z-ed', 4, 'play → played', 'Geçmiş zaman: -ed', '#FF6B5B', 'dun', [
      { t: 'Geçmişte yaptığımız şeyler için fiilin sonuna "ed" ekleriz.', s: 'I/s play+ed/v football/o yesterday/x .', z: 'dun', r: 'ball' },
      { t: 'Geçmişte herkes için aynı! She played, they played.', s: 'She/s watch+ed/v a_film/o .', z: 'dun', r: 'tv' },
      { t: '"e" ile biten fiillere sadece "d" gelir.', s: 'We/s dance+d/v at_the_party/o .', z: 'dun', r: 'dance' },
      { t: 'Dün, geçen hafta gibi zaman kelimeleri ipucu verir.', s: 'They/s visit+ed/v the_museum/o last_week/x .', z: 'dun', tab: [['play', 'played'], ['watch', 'watched'], ['dance', 'danced'], ['visit', 'visited']] }
    ], [['I ___ my room yesterday.', 'cleaned', ['clean', 'cleans'], 'Dün odamı temizledim.'], ['She ___ to music last night.', 'listened', ['listens', 'listen'], 'Dün gece müzik dinledi.'], ['We ___ in the park.', 'walked', ['walk', 'walks'], 'Parkta yürüdük.'],
      ['He ___ the door.', 'opened', ['open', 'opening'], 'Kapıyı açtı.'], ['They ___ a cake.', 'baked', ['bake', 'bakeed'], 'Kek pişirdiler.']],
    ['s|I ___ my grandma last Sunday.|visited|visit,visits|Geçen pazar büyükannemi ziyaret ettim.', 's|It ___ all day yesterday.|rained|rains,rain|Dün bütün gün yağmur yağdı.', 'y|She play tennis yesterday.|0|She played tennis yesterday.|Dün tenis oynadı.', 'y|We watched a cartoon.|1||Çizgi film izledik.',
      'd|He/s jumped/v into_the_pool/o .|Havuza atladı.', 's|They ___ at the joke.|laughed|laugh,laughs|Şakaya güldüler.'], 'dun'),
    k('z-duzensiz', 4, 'go → went', 'Düzensiz fiiller', '#B57BFF', 'dun', [
      { t: 'Bazı fiiller "ed" almaz, tamamen değişir! Go, went olur.', s: 'I/s go>went/v to_the_zoo/o yesterday/x .', z: 'dun' },
      { t: 'Eat, ate olur.', s: 'She/s eat>ate/v a_pizza/o .', z: 'dun', r: 'pizza' },
      { t: 'See, saw olur.', s: 'We/s see>saw/v a_lion/o .', z: 'dun', r: 'lion' },
      { t: 'Bunları ezberlemek oyun gibi!', s: 'They/s have>had/v fun/o .', z: 'dun', tab: [['go', 'went'], ['eat', 'ate'], ['see', 'saw'], ['have', 'had'], ['make', 'made'], ['swim', 'swam']] }
    ], [['We ___ to the beach last summer.', 'went', ['goed', 'go'], 'Geçen yaz plaja gittik.'], ['I ___ a big fish.', 'saw', ['seed', 'see'], 'Büyük bir balık gördüm.'], ['She ___ a sandwich.', 'ate', ['eated', 'eats'], 'Bir sandviç yedi.'],
      ['He ___ a kite.', 'made', ['maked', 'make'], 'Bir uçurtma yaptı.'], ['They ___ in the sea.', 'swam', ['swimmed', 'swim'], 'Denizde yüzdüler.']],
    ['s|I ___ a new bike for my birthday.|got|getted,get|Doğum günümde yeni bisiklet aldım.', 's|We ___ a good time.|had|haved,have|İyi vakit geçirdik.', 'y|He goed home.|0|He went home.|Eve gitti.', 'y|She drank some juice.|1||Biraz meyve suyu içti.',
      'd|We/s saw/v a/x rainbow/o .|Bir gökkuşağı gördük.', 's|The baby ___ all night.|slept|sleeped,sleep|Bebek bütün gece uyudu.'], 'dun'),
    k('z-did', 4, 'Did you...? / didn\'t', 'Geçmişte soru', '#2FB7B0', 'dun', [
      { t: 'Geçmişte soru sorarken başa "Did" koyarız.', s: 'Did/q you/s play/v football/o ?', z: 'dun' },
      { t: '"Did" varsa fiil eski hâline döner: played değil, play!', s: 'Did/q she/s went>go/v to_school/o ?', z: 'dun' },
      { t: 'Olumsuz için "didn\'t" ve fiilin ilk hâli.', s: 'I/s didn\'t/v watch/v TV/o .', z: 'dun' },
      { t: 'Kısa cevaplar: Yes, I did. No, I didn\'t.', s: 'Yes,/x I/s did/v .', z: 'dun', tab: [['soru', 'Did you ...?'], ['evet', 'Yes, I did.'], ['hayır', 'No, I didn\'t.']] }
    ], [['___ you see the film?', 'Did', ['Do', 'Were'], 'Filmi gördün mü?'], ['Did he ___ his homework?', 'do', ['did', 'does'], 'Ödevini yaptı mı?'], ['We ___ go to the cinema.', 'didn\'t', ['don\'t', 'wasn\'t'], 'Sinemaya gitmedik.'],
      ['Did you like it? Yes, I ___.', 'did', ['do', 'liked'], 'Beğendin mi? Evet.'], ['She didn\'t ___ the bus.', 'catch', ['caught', 'catches'], 'Otobüse yetişemedi.']],
    ['s|___ they win the match?|Did|Do,Were|Maçı kazandılar mı?', 's|I didn\'t ___ my lunch.|eat|ate,eats|Öğle yemeğimi yemedim.', 'y|Did you went to the park?|0|Did you go to the park?|Parka gittin mi?', 'y|No, she didn\'t.|1||Hayır, gitmedi.',
      'd|Did/q you/s enjoy/v the_party/o ?|Partiden hoşlandın mı?', 's|He ___ call me yesterday.|didn\'t|doesn\'t,wasn\'t|Dün beni aramadı.'], 'dun'),
    k('z-will', 4, 'will', 'Gelecek: will', '#FFC233', 'yarin', [
      { t: 'Zaman treni yarın istasyonuna gidiyor! Gelecekte olacakları "will" ile söyleriz.', s: 'It/s will/v rain/v tomorrow/x .', z: 'yarin', r: 'rainy' },
      { t: '"Will" herkes için aynı, fiil ek almaz.', s: 'She/s will/v be/v ten/o next_year/x .', z: 'yarin' },
      { t: 'Olumsuz: won\'t.', s: 'I/s won\'t/v forget/v .', z: 'yarin' },
      { t: 'Tahmin ve söz için de kullanırız.', s: 'I/s will/v help/v you/o .', z: 'yarin', tab: [['yapacağım', 'I will'], ['yapmayacağım', 'I won\'t'], ['yapacak mısın?', 'Will you ...?']] }
    ], [['I ___ call you tomorrow.', 'will', ['was', 'did'], 'Yarın seni arayacağım.'], ['People ___ live on Mars one day.', 'will', ['were', 'did'], 'İnsanlar bir gün Mars\'ta yaşayacak.'], ['It ___ be cold tomorrow. (olmayacak)', 'won\'t', ['will', 'didn\'t'], 'Yarın hava soğuk olmayacak.'],
      ['Will you ___ to my party?', 'come', ['came', 'comes'], 'Partime gelecek misin?'], ['She will ___ a doctor.', 'be', ['is', 'was'], 'O doktor olacak.']],
    ['s|We ___ visit Antalya next summer.|will|did,were|Gelecek yaz Antalya\'yı ziyaret edeceğiz.', 's|Don\'t worry, I ___ tell anyone.|won\'t|will,didn\'t|Merak etme, kimseye söylemeyeceğim.', 'y|He will plays tomorrow.|0|He will play tomorrow.|Yarın oynayacak.', 'y|It will be sunny.|1||Hava güneşli olacak.',
      'd|Will/q you/s help/v me/o ?|Bana yardım edecek misin?', 's|Robots ___ do our homework.|will|did,was|Robotlar ödevimizi yapacak.'], 'yarin'),
    k('z-going', 4, 'going to', 'Gelecek: plan', '#FF9E57', 'yarin', [
      { t: 'Önceden planladığımız şeyler için "going to" deriz.', s: 'I/s am/v going_to/v visit/v my_grandma/o .', z: 'yarin', r: 'grandma' },
      { t: 'Önce am, is, are; sonra going to; sonra fiil.', s: 'She/s is/v going_to/v buy/v a_dress/o .', z: 'yarin', r: 'dress' },
      { t: 'Bulutları görünce: yağmur yağacak!', s: 'It/s is/v going_to/v rain/v .', z: 'yarin', r: 'cloud' },
      { t: 'Soru: Ne yapacaksın?', s: 'What/q are/v you/s going_to/v do/v ?', z: 'yarin', tab: [['I', 'am going to'], ['he · she · it', 'is going to'], ['you · we · they', 'are going to']] }
    ], [['We are going to ___ a picnic.', 'have', ['had', 'having'], 'Piknik yapacağız.'], ['He ___ going to play chess.', 'is', ['are', 'am'], 'Satranç oynayacak.'], ['I am ___ to learn French.', 'going', ['go', 'went'], 'Fransızca öğreneceğim.'],
      ['They ___ going to travel.', 'are', ['is', 'am'], 'Seyahat edecekler.'], ['Look! The cat is going to ___.', 'jump', ['jumped', 'jumps'], 'Bak! Kedi zıplayacak.']],
    ['s|She ___ going to paint her room.|is|are,am|Odasını boyayacak.', 's|We are going to ___ a cake.|make|made,makes|Kek yapacağız.', 'y|I am going to read this book.|1||Bu kitabı okuyacağım.', 'y|They is going to swim.|0|They are going to swim.|Yüzecekler.',
      'd|What/q are/v you/s going_to/v wear/v ?|Ne giyeceksin?', 's|It is going to ___. Look at the clouds!|rain|rained,rains|Yağmur yağacak. Bulutlara bak!'], 'yarin'),
    k('z-er', 4, 'big → bigger → biggest', 'Karşılaştırma', '#4CC38A', 'boy', [
      { t: 'İki şeyi karşılaştırırken sıfata "er" ekleriz ve "than" deriz.', s: 'A_horse/s is/v big+ger/x than/x a_dog/o .', b: ['big', 'bigger', 'biggest'] },
      { t: 'En ... olanı söylerken "the" ve "est".', s: 'The_elephant/s is/v the/x big+gest/x .', b: ['big', 'bigger', 'biggest'], r: 'elephant' },
      { t: 'Uzun sıfatlarda "more" ve "the most".', s: 'This_book/s is/v more/x interesting/x .', tab: [['tall', 'taller · the tallest'], ['happy', 'happier · the happiest'], ['beautiful', 'more beautiful · the most beautiful']] },
      { t: 'Bazıları kuralı bozar: good, better, best.', s: 'You/s are/v my/x good>best/x friend/o .' }
    ], [['A cheetah is ___ than a cat.', 'faster', ['fast', 'fastest'], 'Çita kediden hızlıdır.'], ['Ali is the ___ boy in the class.', 'tallest', ['taller', 'tall'], 'Ali sınıftaki en uzun çocuk.'], ['My bag is ___ than yours.', 'heavier', ['heavyer', 'heaviest'], 'Çantam seninkinden ağır.'],
      ['This is the ___ film.', 'best', ['goodest', 'better'], 'Bu en iyi film.'], ['Summer is ___ than winter.', 'hotter', ['hoter', 'hottest'], 'Yaz kıştan sıcaktır.']],
    ['s|An elephant is ___ than a mouse.|bigger|big,biggest|Fil fareden büyüktür.', 's|Everest is the ___ mountain.|highest|higher,high|Everest en yüksek dağdır.', 'y|My dog is more small than your dog.|0|My dog is smaller than your dog.|Köpeğim seninkinden küçük.', 'y|She is the happiest girl.|1||O en mutlu kız.',
      'd|A/x car/s is/v faster/x than/x a_bike/o .|Araba bisikletten hızlıdır.', 's|This is the ___ beautiful flower.|most|more,very|Bu en güzel çiçek.']),
    k('z-should', 4, 'should / shouldn\'t', 'Öğüt vermek', '#FF6B9A', 'should', [
      { t: 'Birine öğüt verirken "should" deriz: -sen iyi olur.', s: 'You/s should/v drink/v water/o .', r: 'thirsty' },
      { t: 'Yapmaması iyi olur derken "shouldn\'t".', s: 'You/s shouldn\'t/v eat/v too_many_sweets/o .', r: 'sweets' },
      { t: 'Hasta arkadaşa öğüt: dinlenmelisin.', s: 'You/s should/v go_to_bed/v .', r: 'sick' },
      { t: 'Soru: Ne yapmalıyım?', s: 'What/q should/v I/s do/v ?', tab: [['iyi olur', 'should'], ['iyi olmaz', 'shouldn\'t'], ['kural', 'must']] }
    ], [['You are tired. You ___ sleep.', 'should', ['shouldn\'t', 'shoulds'], 'Yorgunsun. Uyumalısın.'], ['You ___ watch TV all day.', 'shouldn\'t', ['should', 'shoulds'], 'Bütün gün televizyon izlememelisin.'], ['He should ___ a coat. It\'s cold.', 'wear', ['wears', 'wearing'], 'Mont giymeli. Hava soğuk.'],
      ['___ I call the doctor?', 'Should', ['Shall', 'Did'], 'Doktoru aramalı mıyım?'], ['We ___ eat fruit every day.', 'should', ['shouldn\'t', 'shoulds'], 'Her gün meyve yemeliyiz.']],
    ['s|You have a cold. You ___ stay at home.|should|shouldn\'t,shoulds|Nezlesin. Evde kalmalısın.', 's|You ___ play with matches.|shouldn\'t|should,shoulds|Kibritle oynamamalısın.', 'y|She should studies more.|0|She should study more.|Daha çok çalışmalı.', 'y|We should be kind.|1||Nazik olmalıyız.',
      'd|You/s should/v ask/v your_teacher/o .|Öğretmenine sormalısın.', 's|What ___ I wear?|should|shoulds,did|Ne giymeliyim?']),
    k('z-could', 4, 'could / couldn\'t', 'Geçmişte yapabilmek', '#7E8CFF', 'dun', [
      { t: '"Can" geçmişte "could" olur: -ebildim.', s: 'I/s can>could/v swim/v when_I_was_five/o .', z: 'dun', r: 'swim' },
      { t: 'Yapamadıysak "couldn\'t".', s: 'She/s couldn\'t/v find/v her_keys/o .', z: 'dun', r: 'key' },
      { t: 'Kibar rica için de "could": ... -ebilir misin?', s: 'Could/q you/s help/v me,/o please/x ?' },
      { t: '"Could" dan sonra fiil ek almaz.', s: 'We/s could/v see/v the_stars/o .', z: 'dun', tab: [['şimdi', 'can · can\'t'], ['geçmişte', 'could · couldn\'t']] }
    ], [['When I was three, I ___ read.', 'couldn\'t', ['can\'t', 'could'], 'Üç yaşındayken okuyamazdım.'], ['Yesterday we ___ see the moon.', 'could', ['can', 'cans'], 'Dün ayı görebildik.'], ['___ you open the window, please?', 'Could', ['Did', 'Were'], 'Pencereyi açabilir misin lütfen?'],
      ['He could ___ very fast.', 'run', ['ran', 'runs'], 'Çok hızlı koşabilirdi.'], ['I ___ sleep last night. It was noisy.', 'couldn\'t', ['could', 'can'], 'Dün gece uyuyamadım. Gürültülüydü.']],
    ['s|My grandma ___ dance very well.|could|cans,can\'t|Büyükannem çok iyi dans edebilirdi.', 's|___ you pass the salt, please?|Could|Did,Were|Tuzu uzatabilir misin lütfen?', 'y|She could swims.|0|She could swim.|Yüzebilirdi.', 'y|I couldn\'t find my ball.|1||Topumu bulamadım.',
      'd|Could/q I/s have/v some_water/o ?|Biraz su alabilir miyim?', 's|We ___ go out. It was raining.|couldn\'t|could,can|Dışarı çıkamadık. Yağmur yağıyordu.'], 'dun'),
    k('z-zaman', 4, 'yesterday · today · tomorrow', 'Dün, bugün, yarın', '#FF6B5B', 'saat', [
      { t: 'Zaman treniyle üç istasyonu gezelim. Her gün: geniş zaman.', s: 'I/s play/v football/o every_day/x .', z: 'her', r: 'ball' },
      { t: 'Şu anda: şimdiki zaman.', s: 'I/s am/v playing/v football/o now/x .', z: 'simdi' },
      { t: 'Dün: geçmiş zaman.', s: 'I/s played/v football/o yesterday/x .', z: 'dun' },
      { t: 'Yarın: gelecek zaman.', s: 'I/s will/v play/v football/o tomorrow/x .', z: 'yarin', tab: [['every day', 'play'], ['now', 'am playing'], ['yesterday', 'played'], ['tomorrow', 'will play']] }
    ], [['Yesterday I ___ a cake.', 'made', ['make', 'will make'], 'Dün kek yaptım.'], ['Tomorrow we ___ go to the zoo.', 'will', ['did', 'are'], 'Yarın hayvanat bahçesine gideceğiz.'], ['Look! It ___ snowing now.', 'is', ['was', 'will'], 'Bak! Şimdi kar yağıyor.'],
      ['She ___ to school every day.', 'walks', ['walked', 'will walk'], 'Her gün okula yürür.'], ['Last week they ___ a museum.', 'visited', ['visit', 'will visit'], 'Geçen hafta bir müze gezdiler.']],
    ['s|I ___ my homework yesterday.|did|do,will do|Dün ödevimi yaptım.', 's|We ___ a picnic next Sunday.|will have|had,have|Gelecek pazar piknik yapacağız.', 'y|He is reading now.|1||O şimdi okuyor.', 'y|Tomorrow I visited my aunt.|0|Tomorrow I will visit my aunt.|Yarın teyzemi ziyaret edeceğim.',
      'd|They/s played/v chess/o yesterday/x .|Dün satranç oynadılar.', 's|Every morning she ___ milk.|drinks|drank,will drink|Her sabah süt içer.'], 'hepsi')
  ];
  var SEVIYE = { 2: { ad: 'Kolay', sinif: '2. sınıf', renk: '#4CC38A', mahalle: 'Sabah Mahallesi' }, 3: { ad: 'Orta', sinif: '3. sınıf', renk: '#FFC233', mahalle: 'Öğle Meydanı' }, 4: { ad: 'Zor', sinif: '4. sınıf', renk: '#FF6B5B', mahalle: 'Akşam Garı' } };
  W.KIDS_GRAMER_VERI = { KONU: KONU, SEVIYE: SEVIYE };
})(window);
