/* ==========================================================================
   ACADEX KIDS · CÜMLE GALAKSİSİ DURAK VERİSİ (kids/assets/kids-cumle2.js), 22.11.2026
   Her tema (gezegen) için kids-cumle.js'in beş durağından dördünün verisi
   (beşincisi, cümle blokları, kids-cumle.js VERI'de):
     k  kelime bankası  [İngilizce, Türkçe]          (resim KIDS_RESIM'de varsa gösterilir)
     r  kural kartı     { ad, tr, s: [[sol, sağ]…], o: örnek cümle, ot: örneğin Türkçesi }
     b  boşluk doldurma [cümle "___" ile, doğru, [yanlışlar], Türkçesi, kalıp]
     d  diyalog         [soru, doğru cevap, [yanlış cevaplar], sorunun Türkçesi, kalıp]
   Kalıplar MEB Maarif Modeli İngilizce temalarının "Target Language Chunks"larından.
   kalıp adları veli raporunda gruplanır (KALIP).
   ========================================================================== */
(function (W) {
  'use strict';
  var KALIP = { be: 'am / is / are', soru: 'Soru kelimeleri (what, who, where…)', yer: 'Yer: in / on / at', have: 'have got / has got', can: 'can / can\'t',
    there: 'there is / there are', like: 'like / love / hate', cont: 'Şimdiki zaman (-ing)', simple: 'Geniş zaman (her gün…)', must: 'must / mustn\'t / should',
    past: 'Geçmiş zaman (was, played, went)', karsi: 'Karşılaştırma (taller, the best)', will: 'will / going to', istek: 'Rica ve istek (Can I…? some / any)', tanisma: 'Selamlaşma ve tanışma' };
  var EK = {
    '2-okul': {
      k: [['teacher', 'öğretmen'], ['classroom', 'sınıf'], ['garden', 'bahçe'], ['playground', 'oyun alanı'], ['library', 'kütüphane'], ['canteen', 'kantin'], ['Monday', 'pazartesi'], ['Friday', 'cuma']],
      r: { ad: 'am / is / are', tr: '"Olmak" kişiye göre değişir. Ben → am, o → is, siz/biz/onlar → are.', s: [['I', 'am'], ['He · She · It', 'is'], ['You · We · They', 'are']], o: 'She is my teacher.', ot: 'O benim öğretmenim.' },
      b: [['She ___ in the garden.', 'is', ['am', 'are'], 'O bahçede.', 'be'], ['I ___ Can.', 'am', ['is', 'are'], 'Ben Can\'ım.', 'be'], ['___ is he? He is my teacher.', 'Who', ['What', 'Where'], 'O kim?', 'soru'], ['Where is she? She is ___ the library.', 'in', ['on', 'at'], 'O kütüphanede.', 'yer']],
      d: [['What\'s your name?', 'My name is Can.', ['It is Monday.', 'I am fine.'], 'Adın ne?', 'tanisma'], ['How are you?', 'I\'m fine, thanks!', ['It is a chair.', 'He is my teacher.'], 'Nasılsın?', 'tanisma'], ['What day is it today?', 'It\'s Monday today.', ['She is in the garden.', 'Nice to meet you!'], 'Bugün günlerden ne?', 'soru']]
    },
    '2-sinif': {
      k: [['chair', 'sandalye'], ['desk', 'sıra'], ['board', 'tahta'], ['pencil', 'kalem'], ['ruler', 'cetvel'], ['book', 'kitap'], ['bag', 'çanta'], ['eraser', 'silgi']],
      r: { ad: 'Çoğul: bir → birden çok + s', tr: 'Birden fazla şey için kelimenin sonuna -s gelir.', s: [['a chair', 'two chairs'], ['a book', 'five books'], ['a pencil', 'three pencils']], o: 'How many chairs? Five chairs.', ot: 'Kaç sandalye? Beş sandalye.' },
      b: [['What ___ is it? It is blue.', 'colour', ['day', 'name'], 'O ne renk?', 'soru'], ['How many ___? Three pencils.', 'pencils', ['pencil', 'a pencil'], 'Kaç kalem?', 'soru'], ['___ I go to the bathroom, please?', 'Can', ['Is', 'Am'], 'Tuvalete gidebilir miyim?', 'can'], ['It is ___ turn!', 'my', ['I', 'me'], 'Sıra bende!', 'be']],
      d: [['What colour is the chair?', 'The chair is blue.', ['Five chairs.', 'Yes, you can.'], 'Sandalye ne renk?', 'soru'], ['Can I go to the bathroom, please?', 'Yes, you can.', ['It is red.', 'Good luck!'], 'Tuvalete gidebilir miyim?', 'can'], ['How many books?', 'Two books.', ['It is a book.', 'It\'s my turn!'], 'Kaç kitap?', 'soru']]
    },
    '2-kisisel': {
      k: [['nose', 'burun'], ['eyes', 'gözler'], ['hair', 'saç'], ['hat', 'şapka'], ['shoes', 'ayakkabı'], ['T-shirt', 'tişört'], ['cold', 'soğuk'], ['sunny', 'güneşli']],
      r: { ad: 'have got', tr: '"Var / sahibim" demek için have got kullanılır.', s: [['I', 'have got'], ['You · We · They', 'have got'], ['He · She', 'has got']], o: 'I\'ve got blue eyes.', ot: 'Mavi gözlerim var.' },
      b: [['I ___ blue eyes.', 'have got', ['has got', 'am'], 'Mavi gözlerim var.', 'have'], ['How old ___ you?', 'are', ['is', 'am'], 'Kaç yaşındasın?', 'be'], ['How ___ the weather? It is cold.', 'is', ['are', 'am'], 'Hava nasıl?', 'be'], ['I\'ve got ___ red hat.', 'a', ['an', 'two'], 'Kırmızı bir şapkam var.', 'have']],
      d: [['How old are you?', 'I\'m seven.', ['It is cold.', 'I\'ve got a nose.'], 'Kaç yaşındasın?', 'be'], ['How\'s the weather?', 'It\'s sunny.', ['I\'m fine.', 'Yes, it is.'], 'Hava nasıl?', 'be'], ['What have you got?', 'I\'ve got a red hat.', ['It\'s Monday.', 'I\'m seven.'], 'Neyin var?', 'have']]
    },
    '2-aile': {
      k: [['mother', 'anne'], ['father', 'baba'], ['sister', 'kız kardeş'], ['brother', 'erkek kardeş'], ['baby', 'bebek'], ['family', 'aile'], ['grandmother', 'büyükanne'], ['grandfather', 'büyükbaba']],
      r: { ad: 'he / she · his / her', tr: 'Erkek için he (o) ve his (onun), kadın için she ve her.', s: [['father · brother', 'he'], ['mother · sister', 'she'], ['my mother has got…', 'has got']], o: 'She\'s my mother. She has got blue eyes.', ot: 'O benim annem. Mavi gözleri var.' },
      b: [['___ is my father.', 'He', ['She', 'They'], 'O benim babam.', 'be'], ['My mother ___ blue eyes.', 'has got', ['have got', 'is'], 'Annemin mavi gözleri var.', 'have'], ['Who is ___? She is my sister.', 'she', ['he', 'it'], 'O kim? O kız kardeşim.', 'soru'], ['I ___ hungry!', 'am', ['is', 'are'], 'Acıktım!', 'be']],
      d: [['Who is she?', 'She\'s my mother.', ['He\'s my father.', 'I\'m hungry!'], 'O kim? (kadın)', 'soru'], ['Who is he?', 'He\'s my brother.', ['She\'s my sister.', 'It\'s lunchtime!'], 'O kim? (erkek)', 'soru'], ['I\'m sorry, Mum!', 'That\'s fine!', ['You look great!', 'He\'s my father.'], 'Özür dilerim anne!', 'tanisma']]
    },
    '2-ev': {
      k: [['kitchen', 'mutfak'], ['bedroom', 'yatak odası'], ['bathroom', 'banyo'], ['living room', 'oturma odası'], ['bed', 'yatak'], ['sofa', 'kanepe'], ['cat', 'kedi'], ['dog', 'köpek']],
      r: { ad: 'Nerede? in the kitchen', tr: '"…-de / -da" demek için in the + oda adı.', s: [['mutfakta', 'in the kitchen'], ['yatak odasında', 'in the bedroom'], ['bahçede', 'in the garden']], o: 'Where\'s the cat? The cat is in the kitchen.', ot: 'Kedi nerede? Kedi mutfakta.' },
      b: [['Where ___ the cat?', 'is', ['are', 'am'], 'Kedi nerede?', 'be'], ['The bed is ___ the bedroom.', 'in', ['on', 'at'], 'Yatak yatak odasında.', 'yer'], ['There ___ five cats in the garden.', 'are', ['is', 'am'], 'Bahçede beş kedi var.', 'there'], ['We ___ two pets.', 'have got', ['has got', 'are'], 'İki evcil hayvanımız var.', 'have']],
      d: [['Where\'s the dog?', 'The dog is in the garden.', ['We\'ve got two pets.', 'Come and see!'], 'Köpek nerede?', 'yer'], ['Where is the sofa?', 'It\'s in the living room.', ['It\'s a cat.', 'Yes, I do.'], 'Kanepe nerede?', 'yer'], ['Have you got a pet?', 'Yes, I\'ve got a cat.', ['It\'s in the kitchen.', 'Look around!'], 'Evcil hayvanın var mı?', 'have']]
    },
    '2-sehir': {
      k: [['bread', 'ekmek'], ['banana', 'muz'], ['apple', 'elma'], ['milk', 'süt'], ['egg', 'yumurta'], ['cheese', 'peynir'], ['soup', 'çorba'], ['water', 'su']],
      r: { ad: 'Do you like…? Yes, I do. / No, I don\'t.', tr: 'Sevip sevmediğini sorarken Do you like…? Cevap: Yes, I do ya da No, I don\'t.', s: [['Do you like bread?', 'Yes, I do.'], ['Do you like beans?', 'No, I don\'t.'], ['I like', 'apples']], o: 'Do you like bananas? Yes, I do.', ot: 'Muz sever misin? Evet, severim.' },
      b: [['___ you like bread?', 'Do', ['Is', 'Are'], 'Ekmek sever misin?', 'like'], ['No, I ___.', 'don\'t', ['do', 'not'], 'Hayır, sevmem.', 'like'], ['Is ___ a banana in the kitchen?', 'there', ['it', 'he'], 'Mutfakta muz var mı?', 'there'], ['Can I have ___ bread?', 'some', ['a', 'an'], 'Biraz ekmek alabilir miyim?', 'istek']],
      d: [['Do you like milk?', 'Yes, I do.', ['It\'s delicious!', 'Two eggs.'], 'Süt sever misin?', 'like'], ['Can I have some soup?', 'Yes, you can.', ['No, I don\'t.', 'I\'m hungry!'], 'Biraz çorba alabilir miyim?', 'istek'], ['Is there an apple in the kitchen?', 'Yes, there is.', ['Yes, I do.', 'Enjoy your meal!'], 'Mutfakta elma var mı?', 'there']]
    },
    '3-okul': {
      k: [['nurse', 'hemşire'], ['library', 'kütüphane'], ['September', 'eylül'], ['birthday', 'doğum günü'], ['rules', 'kurallar'], ['corridor', 'koridor'], ['classroom', 'sınıf'], ['teacher', 'öğretmen']],
      r: { ad: 'must / mustn\'t', tr: 'Kurallar için: must = yapmalısın, mustn\'t = yapmamalısın.', s: [['You must', 'follow the rules'], ['You mustn\'t', 'run in the corridor'], ['You mustn\'t', 'shout']], o: 'You must listen to your teacher.', ot: 'Öğretmenini dinlemelisin.' },
      b: [['You ___ run in the corridor.', 'mustn\'t', ['must', 'can'], 'Koridorda koşmamalısın.', 'must'], ['You ___ follow the rules.', 'must', ['mustn\'t', 'are'], 'Kurallara uymalısın.', 'must'], ['Is there a nurse ___ school?', 'at', ['in', 'on'], 'Okulda hemşire var mı?', 'yer'], ['I am eight ___ old.', 'years', ['year', 'old'], 'Sekiz yaşındayım.', 'be']],
      d: [['What month is it now?', 'It\'s September.', ['I\'m eight years old.', 'Happy birthday!'], 'Şimdi hangi aydayız?', 'soru'], ['Where is Daphne?', 'She\'s in the library.', ['It\'s Monday.', 'See you later!'], 'Daphne nerede?', 'yer'], ['Is there a nurse at school?', 'Yes, there is.', ['Yes, I am.', 'You must.'], 'Okulda hemşire var mı?', 'there']]
    },
    '3-sinif': {
      k: [['clock', 'saat'], ['ruler', 'cetvel'], ['scissors', 'makas'], ['glue', 'yapıştırıcı'], ['winter', 'kış'], ['spring', 'ilkbahar'], ['summer', 'yaz'], ['autumn', 'sonbahar']],
      r: { ad: 'There is / There are', tr: 'Bir şey varsa there is, birden çok şey varsa there are.', s: [['bir cetvel', 'There is a ruler.'], ['iki cetvel', 'There are two rulers.'], ['var mı?', 'Is there…? / Are there…?']], o: 'There are two rulers on the table.', ot: 'Masada iki cetvel var.' },
      b: [['There ___ two rulers on the table.', 'are', ['is', 'am'], 'Masada iki cetvel var.', 'there'], ['There ___ a clock on the wall.', 'is', ['are', 'have'], 'Duvarda bir saat var.', 'there'], ['What ___ is it? It\'s five o\'clock.', 'time', ['day', 'colour'], 'Saat kaç?', 'soru'], ['How many pencils have you ___?', 'got', ['get', 'are'], 'Kaç kalemin var?', 'have']],
      d: [['What time is it?', 'It\'s five o\'clock.', ['It\'s Maths.', 'They are rulers.'], 'Saat kaç?', 'soru'], ['What are they?', 'They are rulers.', ['It is raining.', 'There is a clock.'], 'Onlar ne?', 'soru'], ['How\'s the weather today?', 'It\'s raining today.', ['It\'s ten o\'clock.', 'Yes, there is.'], 'Bugün hava nasıl?', 'cont']]
    },
    '3-kisisel': {
      k: [['tall', 'uzun boylu'], ['short', 'kısa boylu'], ['dress', 'elbise'], ['sunglasses', 'güneş gözlüğü'], ['shoes', 'ayakkabı'], ['trousers', 'pantolon'], ['hat', 'şapka'], ['T-shirt', 'tişört']],
      r: { ad: 'Şimdiki zaman: am / is / are + -ing', tr: 'Şu an olan şeyi anlatmak için: am/is/are + fiil + ing.', s: [['I', 'am wearing'], ['She', 'is wearing'], ['They', 'are wearing']], o: 'I\'m wearing a T-shirt today.', ot: 'Bugün tişört giyiyorum.' },
      b: [['I am ___ a T-shirt today.', 'wearing', ['wear', 'wears'], 'Bugün tişört giyiyorum.', 'cont'], ['What ___ you wearing?', 'are', ['is', 'do'], 'Ne giyiyorsun?', 'cont'], ['___ dress is this? It\'s Jasmine\'s.', 'Whose', ['Who', 'What'], 'Bu kimin elbisesi?', 'soru'], ['I ___ big sunglasses.', 'love', ['loves', 'am love'], 'Büyük güneş gözlüklerini severim.', 'like']],
      d: [['What does she look like?', 'She\'s tall and beautiful.', ['She\'s wearing a dress.', 'It\'s Jasmine\'s dress.'], 'O neye benziyor?', 'be'], ['Whose dress is this?', 'It\'s Jasmine\'s dress.', ['I\'m wearing a dress.', 'She is tall.'], 'Bu kimin elbisesi?', 'soru'], ['What are you wearing today?', 'I\'m wearing a T-shirt.', ['I love T-shirts.', 'It\'s my pleasure!'], 'Bugün ne giyiyorsun?', 'cont']]
    },
    '3-aile': {
      k: [['cook', 'yemek yapmak'], ['swim', 'yüzmek'], ['breakfast', 'kahvaltı'], ['piano', 'piyano'], ['always', 'her zaman'], ['never', 'asla'], ['sometimes', 'bazen'], ['every morning', 'her sabah']],
      r: { ad: 'Geniş zaman: he / she → fiil + s', tr: 'Her gün yapılan işleri anlatırken o (he/she) ile fiile -s gelir.', s: [['I', 'prepare'], ['She', 'prepares'], ['My father', 'reads']], o: 'She prepares breakfast every morning.', ot: 'O her sabah kahvaltı hazırlar.' },
      b: [['She ___ breakfast every morning.', 'prepares', ['prepare', 'preparing'], 'O her sabah kahvaltı hazırlar.', 'simple'], ['My father ___ cook.', 'can', ['cans', 'is'], 'Babam yemek yapabilir.', 'can'], ['My sister ___ swim. She is a baby.', 'can\'t', ['can', 'is'], 'Kız kardeşim yüzemez.', 'can'], ['___ you help me, please?', 'Could', ['Do', 'Are'], 'Bana yardım eder misin lütfen?', 'istek']],
      d: [['How old is your mother?', 'She\'s thirty-five.', ['She can cook.', 'Every morning.'], 'Annen kaç yaşında?', 'be'], ['What does she do every morning?', 'She prepares breakfast.', ['She is thirty.', 'No problem!'], 'O her sabah ne yapar?', 'simple'], ['Could you help me, please?', 'No problem!', ['She can\'t swim.', 'Follow me!'], 'Bana yardım eder misin?', 'istek']]
    },
    '3-ciftlik': {
      k: [['farmer', 'çiftçi'], ['cow', 'inek'], ['hen', 'tavuk'], ['horse', 'at'], ['sheep', 'koyun'], ['tractor', 'traktör'], ['corn', 'mısır'], ['vegetables', 'sebzeler']],
      r: { ad: 'Şimdi mi, her gün mü?', tr: 'Her gün yapılan: I milk the cows. Şu an yapılan: He is milking the cows now.', s: [['her gün', 'I milk the cows.'], ['şimdi', 'I am milking the cows.'], ['şimdi (o)', 'He is watering the vegetables.']], o: 'What is the farmer doing now? He is watering the vegetables.', ot: 'Çiftçi şimdi ne yapıyor? Sebzeleri suluyor.' },
      b: [['There ___ five cows on our farm.', 'are', ['is', 'am'], 'Çiftliğimizde beş inek var.', 'there'], ['He is ___ the vegetables now.', 'watering', ['water', 'waters'], 'Şimdi sebzeleri suluyor.', 'cont'], ['I ___ our cows every day.', 'milk', ['milking', 'milks'], 'Her gün ineklerimizi sağarım.', 'simple'], ['The hens ___ eating corn.', 'are', ['is', 'am'], 'Tavuklar mısır yiyor.', 'cont']],
      d: [['What is the farmer doing now?', 'He\'s watering the vegetables.', ['He waters the vegetables.', 'There is a farm.'], 'Çiftçi şimdi ne yapıyor?', 'cont'], ['What is there on your farm?', 'There\'s a farmhouse.', ['I milk the cows.', 'No way!'], 'Çiftliğinde ne var?', 'there'], ['What do you do every day?', 'I feed the hens.', ['I\'m feeding the hens now.', 'How beautiful!'], 'Her gün ne yaparsın?', 'simple']]
    },
    '3-sehir': {
      k: [['salad', 'salata'], ['soup', 'çorba'], ['fruit', 'meyve'], ['olives', 'zeytin'], ['salt', 'tuz'], ['pizza', 'pizza'], ['bread', 'ekmek'], ['cheese', 'peynir']],
      r: { ad: 'some / any', tr: 'Olumlu cümlede some, soru cümlesinde any.', s: [['I want', 'some salad'], ['Have you got', 'any olives?'], ['Yes, I\'ve got', 'some olives']], o: 'Have you got any olives? Yes, I\'ve got some.', ot: 'Zeytinin var mı? Evet, biraz var.' },
      b: [['I want ___ salad, please.', 'some', ['any', 'a'], 'Biraz salata istiyorum lütfen.', 'istek'], ['Have you got ___ olives?', 'any', ['some', 'a'], 'Hiç zeytinin var mı?', 'istek'], ['___ I have some soup, please?', 'Can', ['Do', 'Am'], 'Biraz çorba alabilir miyim?', 'istek'], ['What ___ you want?', 'do', ['are', 'is'], 'Ne istersin?', 'simple']],
      d: [['What do you want?', 'I want some salad, please.', ['Enjoy your meal!', 'Yes, I\'ve got some.'], 'Ne istersin?', 'istek'], ['Have you got any olives?', 'Yes, I\'ve got some olives.', ['I\'ll take some fruit.', 'Pass me the salt.'], 'Hiç zeytinin var mı?', 'istek'], ['Enjoy your meal!', 'Thank you!', ['I want some soup.', 'Yes, you can.'], 'Afiyet olsun!', 'tanisma']]
    },
    '4-okul': {
      k: [['always', 'her zaman'], ['today', 'bugün'], ['music', 'müzik'], ['June', 'haziran'], ['smartest', 'en zeki'], ['favourite', 'en sevdiğim'], ['next week', 'gelecek hafta'], ['morning', 'sabah']],
      r: { ad: 'Her zaman mı, bugün mü?', tr: 'Alışkanlık: I always read. Şu an / bugün: I am reading today.', s: [['her zaman', 'I always read books.'], ['bugün', 'I am listening to music.'], ['en …', 'the smartest group']], o: 'I always read books in the morning but I am listening to music today.', ot: 'Sabahları hep kitap okurum ama bugün müzik dinliyorum.' },
      b: [['I always ___ books in the morning.', 'read', ['reading', 'am read'], 'Sabahları hep kitap okurum.', 'simple'], ['I am ___ to music today.', 'listening', ['listen', 'listens'], 'Bugün müzik dinliyorum.', 'cont'], ['This is the ___ group in the school.', 'smartest', ['smart', 'smarter'], 'Bu okulun en zeki grubu.', 'karsi'], ['My favourite month ___ June.', 'is', ['are', 'am'], 'En sevdiğim ay haziran.', 'be']],
      d: [['What are you doing now?', 'I\'m listening to music.', ['I always listen to music.', 'See you next week!'], 'Şu an ne yapıyorsun?', 'cont'], ['What do you do in the morning?', 'I always read books.', ['I\'m reading a book now.', 'I can\'t wait!'], 'Sabahları ne yaparsın?', 'simple'], ['What\'s your favourite month?', 'My favourite month is June.', ['It\'s Monday today.', 'Yes, I do.'], 'En sevdiğin ay hangisi?', 'soru']]
    },
    '4-sinif': {
      k: [['Maths', 'matematik'], ['glue', 'yapıştırıcı'], ['pen', 'tükenmez kalem'], ['folder', 'dosya'], ['lesson', 'ders'], ['last year', 'geçen yıl'], ['words', 'kelimeler'], ['scissors', 'makas']],
      r: { ad: 'was / were (geçmiş)', tr: '"İdi / -dı" demek için: I/he/she → was, you/we/they → were.', s: [['I · He · She · It', 'was'], ['You · We · They', 'were'], ['şimdi', 'is / are']], o: 'My favourite lesson was Maths last year.', ot: 'Geçen yıl en sevdiğim ders matematikti.' },
      b: [['My favourite lesson ___ Maths last year.', 'was', ['is', 'were'], 'Geçen yıl en sevdiğim ders matematikti.', 'past'], ['I like ___ new words.', 'learning', ['learn', 'learns'], 'Yeni kelimeler öğrenmeyi severim.', 'like'], ['There ___ some glue on the paper.', 'is', ['are', 'were'], 'Kağıtta biraz yapıştırıcı var.', 'there'], ['___ pens are they? They are my pens.', 'Whose', ['Who', 'Where'], 'Bunlar kimin kalemleri?', 'soru']],
      d: [['What was your favourite lesson last year?', 'It was Maths.', ['It is ten past five.', 'They are my pens.'], 'Geçen yıl en sevdiğin ders neydi?', 'past'], ['What do you like doing in English lessons?', 'I like learning new words.', ['I was in the library.', 'There is some glue.'], 'İngilizce derslerinde ne yapmayı seversin?', 'like'], ['What\'s the time now?', 'It\'s ten past five.', ['It was Maths.', 'We do sports.'], 'Şimdi saat kaç?', 'soru']]
    },
    '4-kisisel': {
      k: [['yesterday', 'dün'], ['played', 'oynadı'], ['piano', 'piyano'], ['taller', 'daha uzun'], ['cardigan', 'hırka'], ['hobby', 'hobi'], ['could', '-ebiliyordu'], ['weather', 'hava']],
      r: { ad: 'Geçmiş zaman: fiil + ed', tr: 'Dün yapılanı anlatırken fiile -ed gelir: play → played.', s: [['play', 'played'], ['watch', 'watched'], ['can → (geçmiş)', 'could']], o: 'I played games at school yesterday.', ot: 'Dün okulda oyun oynadım.' },
      b: [['I ___ games yesterday.', 'played', ['play', 'playing'], 'Dün oyun oynadım.', 'past'], ['What ___ you do yesterday?', 'did', ['do', 'are'], 'Dün ne yaptın?', 'past'], ['My sister is ___ than me.', 'taller', ['tall', 'tallest'], 'Kız kardeşim benden uzun.', 'karsi'], ['I ___ play the piano when I was six.', 'could', ['can', 'cans'], 'Altı yaşında piyano çalabiliyordum.', 'past']],
      d: [['What did you do yesterday?', 'I played games.', ['I play games every day.', 'It fits like a glove!'], 'Dün ne yaptın?', 'past'], ['What could you do when you were six?', 'I could swim.', ['I can swim now.', 'I\'m wearing a cardigan.'], 'Altı yaşındayken ne yapabiliyordun?', 'past'], ['What are you wearing today?', 'I\'m wearing a blue cardigan.', ['I wore a hat.', 'My sister is taller.'], 'Bugün ne giyiyorsun?', 'cont']]
    },
    '4-aile': {
      k: [['doctor', 'doktor'], ['teacher', 'öğretmen'], ['cook', 'aşçı'], ['bakery', 'fırın'], ['kindest', 'en nazik'], ['last night', 'dün gece'], ['went', 'gitti'], ['reading', 'okumak']],
      r: { ad: 'En …: the kindest, the best', tr: 'Bir grubun en … olanı için the + sıfat + est.', s: [['kind', 'the kindest'], ['tall', 'the tallest'], ['good', 'the best']], o: 'My brother is the kindest person in our family.', ot: 'Erkek kardeşim ailemizin en nazik kişisi.' },
      b: [['What ___ your mother do?', 'does', ['do', 'is'], 'Annen ne iş yapar?', 'simple'], ['My brother is the ___ person.', 'kindest', ['kind', 'kinder'], 'Erkek kardeşim en nazik kişi.', 'karsi'], ['She loves ___ books.', 'reading', ['read', 'reads'], 'Kitap okumayı çok sever.', 'like'], ['My dad ___ to the bakery yesterday.', 'went', ['go', 'goes'], 'Babam dün fırına gitti.', 'past']],
      d: [['What does your father do?', 'He\'s a doctor.', ['He went to the bakery.', 'He loves reading.'], 'Baban ne iş yapar?', 'simple'], ['What does your sister love doing?', 'She loves drawing pictures.', ['She is the kindest.', 'She\'s a teacher.'], 'Kız kardeşin ne yapmayı sever?', 'like'], ['What did you read last night?', 'I read a book about animals.', ['I read every day.', 'I\'m reading now.'], 'Dün gece ne okudun?', 'past']]
    },
    '4-deniz': {
      k: [['beach', 'plaj'], ['seal', 'fok'], ['dolphin', 'yunus'], ['ocean', 'okyanus'], ['plastic', 'plastik'], ['rubbish', 'çöp'], ['sunny', 'güneşli'], ['sea', 'deniz']],
      r: { ad: 'should not / mustn\'t · will', tr: 'Tavsiye: should not (yapmamalıyız). Kural: mustn\'t. Tahmin: will (olacak).', s: [['tavsiye', 'We should not throw plastic.'], ['kural', 'You mustn\'t throw rubbish.'], ['tahmin', 'I think it will be sunny.']], o: 'We should not throw plastic in the ocean.', ot: 'Okyanusa plastik atmamalıyız.' },
      b: [['We should ___ throw plastic in the ocean.', 'not', ['no', 'don\'t'], 'Okyanusa plastik atmamalıyız.', 'must'], ['I think it ___ be sunny tomorrow.', 'will', ['is', 'was'], 'Bence yarın hava güneşli olacak.', 'will'], ['There ___ a lot of seals on the beach last Friday.', 'were', ['are', 'is'], 'Geçen cuma plajda çok fok vardı.', 'past'], ['My sister is the ___ cook in our family.', 'best', ['good', 'better'], 'Kız kardeşim ailenin en iyi aşçısı.', 'karsi']],
      d: [['What will the weather be like?', 'I think it will be sunny.', ['It was sunny.', 'We should swim.'], 'Hava nasıl olacak?', 'will'], ['Can I throw rubbish into the sea?', 'No, you mustn\'t.', ['Yes, there were.', 'It will be sunny.'], 'Denize çöp atabilir miyim?', 'must'], ['Where do dolphins live?', 'They live in the sea.', ['They lived on the beach.', 'There are no seals.'], 'Yunuslar nerede yaşar?', 'simple']]
    },
    '4-sehir': {
      k: [['Italy', 'İtalya'], ['pasta', 'makarna'], ['pizza', 'pizza'], ['cucumber', 'salatalık'], ['holiday', 'tatil'], ['delicious', 'lezzetli'], ['starving', 'çok aç'], ['plane', 'uçak']],
      r: { ad: 'going to (gelecek plan)', tr: 'Planlanmış gelecek için: am / is / are + going to + fiil.', s: [['I', 'am going to go'], ['We', 'are going to go'], ['She', 'is going to go']], o: 'We\'re going to go to Italy next week.', ot: 'Gelecek hafta İtalya\'ya gideceğiz.' },
      b: [['We are going ___ go to Italy.', 'to', ['for', 'at'], 'İtalya\'ya gideceğiz.', 'will'], ['Where ___ you going to go?', 'are', ['is', 'do'], 'Nereye gideceksin?', 'will'], ['Pasta is the ___ delicious food.', 'most', ['more', 'much'], 'Makarna en lezzetli yemek.', 'karsi'], ['We are going to put a ___ cucumbers in it.', 'few', ['little', 'much'], 'İçine birkaç salatalık koyacağız.', 'istek']],
      d: [['Where are you going to go on holiday?', 'We\'re going to go to Italy.', ['We went to Italy.', 'It tastes good!'], 'Tatilde nereye gideceksin?', 'will'], ['How is the pizza?', 'It tastes good!', ['I\'m going to eat.', 'I\'m starving.'], 'Pizza nasıl?', 'tanisma'], ['Are you hungry?', 'Yes, I\'m starving!', ['Yes, it tastes good.', 'We\'re going to Italy.'], 'Aç mısın?', 'be']]
    }
  };
  W.KIDS_CUMLE_EK = { EK: EK, KALIP: KALIP };
})(window);
