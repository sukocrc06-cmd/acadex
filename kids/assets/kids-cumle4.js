/* ==========================================================================
   ACADEX KIDS · CÜMLE GALAKSİSİ: GRAMER YOĞUNLUĞU (kids/assets/kids-cumle4.js), 27.11.2026
   ŞİMDİLİK YALNIZ TEST EKİBİNDE (W.KIDS_EKIP, kids-test.js). Herkese açmak için: ACIK = true.
     GRAMER[tema]  gezegenin "Gramer istasyonu": Zaman Makinesi Kasabası'ndan o temaya ve sınıfa uyan
                   iki konu (kids-gramer2.js kimlikleri; ilerleme kasabayla ortak, il.gramer).
     EKC[tema]     cümle kur durağına eklenen yeni cümleler (MEB tema kalıplarıyla), biçim kids-cumle.js VERI ile aynı.
     KA[tema]      "Kural" kartının canlı örneği: kelime karakterleri, ek (+), dönüşüm (>), zaman treni (z).
   ========================================================================== */
(function (W) {
  'use strict';
  var ACIK = false;
  var GRAMER = {
    '2-okul': ['k-be', 'k-soru'], '2-sinif': ['k-cogul', 'k-this'], '2-kisisel': ['k-have', 'k-can'], '2-aile': ['k-my', 'k-be'], '2-ev': ['k-yer', 'k-emir'], '2-sehir': ['k-aan', 'k-can'],
    '3-okul': ['o-must', 'o-zamanedat'], '3-sinif': ['o-there', 'o-simdiki'], '3-kisisel': ['o-sifat', 'o-iyelik'], '3-aile': ['o-genis', 'o-siklik'], '3-ciftlik': ['o-genis', 'o-simdiki'], '3-sehir': ['o-some', 'o-like'],
    '4-okul': ['z-zaman', 'z-er'], '4-sinif': ['z-was', 'z-did'], '4-kisisel': ['z-ed', 'z-could'], '4-aile': ['z-er', 'z-duzensiz'], '4-deniz': ['z-should', 'z-will'], '4-sehir': ['z-going', 'z-did']
  };
  var EKC = {
    '2-okul': [['Hello,/x I/s am/v Elif/o .', 'Merhaba, ben Elif.'], ['This/s is/v my/o classroom/o .', 'Burası benim sınıfım.'], ['Where/q is/v the_canteen/s ?', 'Kantin nerede?'], ['It/s is/v next_to/o the_library/o .', 'Kütüphanenin yanında.'],
      ['Who/q is/v your/o friend/s ?', 'Arkadaşın kim?'], ['We/s are/v in/o the_playground/o .', 'Oyun alanındayız.'], ['Today/x is/v Friday/o .', 'Bugün cuma.']],
    '2-sinif': [['Open/v your_book,/o please/x .', 'Kitabını aç lütfen.'], ['The_board/s is/v green/o .', 'Tahta yeşil.'], ['I/s have_got/v three/o rulers/o .', 'Üç cetvelim var.'], ['How_many/q books/o are_there/v ?', 'Kaç kitap var?'],
      ['There_are/v ten/o desks/o .', 'On sıra var.'], ['Can/q I/s use/v your_eraser/o ?', 'Silgini kullanabilir miyim?'], ['This/s is/v a/o red/o pencil/o .', 'Bu kırmızı bir kalem.']],
    '2-kisisel': [['I/s am/v eight/o .', 'Sekiz yaşındayım.'], ['She/s has_got/v long/o hair/o .', 'Onun uzun saçı var.'], ['It/s is/v sunny/o today/o .', 'Bugün hava güneşli.'], ['I/s can/v ride/v a_bike/o .', 'Bisiklet sürebilirim.'],
      ['Have/q you/s got/v a_pet/o ?', 'Evcil hayvanın var mı?'], ['My/o favourite/o colour/s is/v blue/o .', 'En sevdiğim renk mavi.'], ['Happy_birthday/o to/x you/s !', 'İyi ki doğdun!']],
    '2-aile': [['This/s is/v my/o grandma/o .', 'Bu benim büyükannem.'], ['My_father/s is/v tall/o .', 'Babam uzun boylu.'], ['Her/o name/s is/v Zeynep/o .', 'Onun adı Zeynep.'], ['His/o eyes/s are/v brown/o .', 'Onun gözleri kahverengi.'],
      ['I/s have_got/v a/o baby/o brother/o .', 'Bir bebek erkek kardeşim var.'], ['We/s are/v a/o big/o family/o .', 'Biz büyük bir aileyiz.'], ['I/s love/v my/o family/o !', 'Ailemi seviyorum!']],
    '2-ev': [['The_lamp/s is/v on/o the_table/o .', 'Lamba masanın üstünde.'], ['The_dog/s is/v under/o the_bed/o .', 'Köpek yatağın altında.'], ['My_room/s is/v small/o .', 'Odam küçük.'], ['There_is/v a/o sofa/o in_the_living_room/o .', 'Oturma odasında bir kanepe var.'],
      ['Where/q is/v my/o ball/s ?', 'Topum nerede?'], ['Close/v the_door,/o please/x .', 'Kapıyı kapat lütfen.'], ['Our_house/s has_got/v a/o garden/o .', 'Evimizin bir bahçesi var.']],
    '2-sehir': [['I/s like/v bananas/o .', 'Muzları severim.'], ['I/s don\'t_like/v carrots/o .', 'Havuçları sevmem.'], ['Do/q you/s like/v milk/o ?', 'Süt sever misin?'], ['Can/q I/s have/v an/o apple/o ?', 'Bir elma alabilir miyim?'],
      ['It/s is/v an/o orange/o .', 'Bu bir portakal.'], ['I/s am/v thirsty/o .', 'Susadım.'], ['The_cake/s is/v yummy/o !', 'Kek çok lezzetli!']],
    '3-okul': [['You/s must/v be/v quiet/o in_the_library/o .', 'Kütüphanede sessiz olmalısın.'], ['You/s mustn\'t/v eat/v in_class/o .', 'Sınıfta yemek yememelisin.'], ['School/s starts/v at/x nine_o\'clock/o .', 'Okul saat dokuzda başlar.'],
      ['My/o birthday/s is/v in/x March/o .', 'Doğum günüm martta.'], ['We/s have/v PE/o on/x Monday/o .', 'Pazartesi beden eğitimi dersimiz var.'], ['Is_there/q a/o gym/o at_school/o ?', 'Okulda spor salonu var mı?'], ['You/s must/v wear/v a/o uniform/o .', 'Forma giymelisin.']],
    '3-sinif': [['There_is/v a/o map/o on_the_wall/o .', 'Duvarda bir harita var.'], ['There_are/v twenty/o students/o in_my_class/o .', 'Sınıfımda yirmi öğrenci var.'], ['It/s is/v half_past/o three/o .', 'Saat üç buçuk.'],
      ['The_teacher/s is/v writing/v on_the_board/o .', 'Öğretmen tahtaya yazıyor.'], ['We/s are/v reading/v a/o story/o .', 'Bir hikâye okuyoruz.'], ['It/s is/v snowing/v now/o .', 'Şimdi kar yağıyor.'], ['Is_there/q a/o clock/o in_the_classroom/o ?', 'Sınıfta saat var mı?']],
    '3-kisisel': [['He/s has_got/v curly/o hair/o .', 'Onun kıvırcık saçı var.'], ['My/o shoes/s are/v new/o .', 'Ayakkabılarım yeni.'], ['Whose/q hat/o is/v this/s ?', 'Bu kimin şapkası?'], ['It/s is/v Can\'s/o hat/o .', 'Bu Can\'ın şapkası.'],
      ['She/s is/v wearing/v a/o yellow/o skirt/o .', 'Sarı bir etek giyiyor.'], ['I/s have_got/v big/o brown/o eyes/o .', 'Büyük kahverengi gözlerim var.'], ['He/s is/v short/o and/x funny/o .', 'O kısa boylu ve komik.']],
    '3-aile': [['My_mum/s gets_up/v at/x seven/o .', 'Annem yedide kalkar.'], ['My_dad/s drives/v to_work/o .', 'Babam işe arabayla gider.'], ['My_grandpa/s often/x tells/v stories/o .', 'Dedem sık sık hikâye anlatır.'],
      ['We/s never/x eat/v dinner/o late/o .', 'Asla geç akşam yemeği yemeyiz.'], ['My_sister/s plays/v the_violin/o .', 'Kız kardeşim keman çalar.'], ['Does/q your/o brother/s like/v football/o ?', 'Kardeşin futbol sever mi?'], ['We/s usually/x visit/v grandma/o on_Sundays/o .', 'Genellikle pazar günleri büyükanneyi ziyaret ederiz.']],
    '3-ciftlik': [['The_cow/s gives/v us/o milk/o .', 'İnek bize süt verir.'], ['The_horse/s is/v running/v now/o .', 'At şimdi koşuyor.'], ['Chickens/s lay/v eggs/o every_day/o .', 'Tavuklar her gün yumurtlar.'],
      ['The_farmer/s is/v feeding/v the_sheep/o .', 'Çiftçi koyunları besliyor.'], ['There_are/v ducks/o on_the_pond/o .', 'Gölette ördekler var.'], ['The_dog/s is/v sleeping/v in_the_barn/o .', 'Köpek ahırda uyuyor.'], ['We/s pick/v apples/o in_autumn/o .', 'Sonbaharda elma toplarız.']],
    '3-sehir': [['I/s would_like/v some/o pizza/o .', 'Biraz pizza istiyorum.'], ['Is_there/q any/o juice/o ?', 'Meyve suyu var mı?'], ['There_isn\'t/v any/o bread/o .', 'Hiç ekmek yok.'], ['I/s like/v eating/o pasta/o .', 'Makarna yemeyi severim.'],
      ['She/s loves/v making/o cakes/o .', 'Kek yapmayı çok sever.'], ['Can/q I/s have/v the_menu,/o please/x ?', 'Menüyü alabilir miyim lütfen?'], ['The_soup/s is/v hot/o .', 'Çorba sıcak.']],
    '4-okul': [['Yesterday/x we/s had/v a/o test/o .', 'Dün sınavımız vardı.'], ['Tomorrow/x we/s will/v go/v on_a_trip/o .', 'Yarın geziye gideceğiz.'], ['Our/o class/s is/v the_biggest/o .', 'Bizim sınıf en büyüğü.'],
      ['Science/s is/v more_interesting/o than/x Maths/o .', 'Fen matematikten daha ilginç.'], ['I/s study/v English/o every_day/o .', 'Her gün İngilizce çalışırım.'], ['Now/x I/s am/v doing/v my/o homework/o .', 'Şimdi ödevimi yapıyorum.'], ['Last_year/x I/s was/v in/x third_grade/o .', 'Geçen yıl üçüncü sınıftaydım.']],
    '4-sinif': [['Where/q were/v you/s yesterday/o ?', 'Dün neredeydin?'], ['I/s was/v at_school/o .', 'Okuldaydım.'], ['Did/q you/s finish/v your_project/o ?', 'Projeni bitirdin mi?'], ['Yes,/x I/s did/v .', 'Evet, bitirdim.'],
      ['We/s didn\'t/v have/v art/o yesterday/o .', 'Dün resim dersimiz yoktu.'], ['The_lesson/s was/v fun/o .', 'Ders eğlenceliydi.'], ['Were/q they/s in_the_library/o ?', 'Kütüphanede miydiler?']],
    '4-kisisel': [['I/s watched/v a_film/o last_night/o .', 'Dün gece film izledim.'], ['She/s visited/v her/o aunt/o .', 'Teyzesini ziyaret etti.'], ['We/s played/v basketball/o .', 'Basketbol oynadık.'],
      ['I/s couldn\'t/v swim/v when/x I/s was/v five/o .', 'Beş yaşındayken yüzemezdim.'], ['He/s could/v ride/v a_bike/o at/x four/o .', 'Dört yaşında bisiklet sürebiliyordu.'], ['I/s cleaned/v my/o room/o .', 'Odamı temizledim.'], ['They/s danced/v at_the_party/o .', 'Partide dans ettiler.']],
    '4-aile': [['My_grandma/s is/v the_oldest/o in_my_family/o .', 'Büyükannem ailemin en yaşlısı.'], ['My_brother/s is/v older/o than/x me/o .', 'Abim benden büyük.'], ['We/s went/v to_the_cinema/o .', 'Sinemaya gittik.'],
      ['My_mum/s made/v a/o pie/o .', 'Annem turta yaptı.'], ['I/s saw/v my/o cousins/o .', 'Kuzenlerimi gördüm.'], ['Dad/s bought/v a/o new/o car/o .', 'Babam yeni bir araba aldı.'], ['She/s is/v the_best/o mum/o !', 'O en iyi anne!']],
    '4-deniz': [['You/s should/v wear/v sunscreen/o .', 'Güneş kremi sürmelisin.'], ['We/s shouldn\'t/v swim/v alone/o .', 'Yalnız yüzmemeliyiz.'], ['It/s will/v be/v windy/o tomorrow/o .', 'Yarın hava rüzgârlı olacak.'],
      ['I/s will/v build/v a/o sandcastle/o .', 'Bir kumdan kale yapacağım.'], ['Turtles/s will/v lay/v eggs/o on_the_beach/o .', 'Kaplumbağalar kumsala yumurta bırakacak.'], ['You/s should/v keep/v the_beach/o clean/o .', 'Plajı temiz tutmalısın.'], ['Will/q you/s come/v with_us/o ?', 'Bizimle gelecek misin?']],
    '4-sehir': [['I/s am/v going_to/v visit/v London/o .', 'Londra\'yı ziyaret edeceğim.'], ['She/s is/v going_to/v learn/v Spanish/o .', 'İspanyolca öğrenecek.'], ['Did/q you/s like/v the_food/o ?', 'Yemeği beğendin mi?'],
      ['We/s didn\'t/v see/v the_museum/o .', 'Müzeyi görmedik.'], ['Are/q you/s going_to/v take/v photos/o ?', 'Fotoğraf çekecek misin?'], ['They/s are/v going_to/v fly/v to_Japan/o .', 'Japonya\'ya uçacaklar.'], ['Did/q he/s buy/v souvenirs/o ?', 'Hediyelik eşya aldı mı?']]
  };
  /* Kural kartının canlı örneği */
  var KA = {
    '2-okul': { s: 'She/s is/v my_teacher/o .' }, '2-sinif': { s: 'two/x chair+s/o' }, '2-kisisel': { s: 'He/s has_got/v a_red/o hat/o .' }, '2-aile': { s: 'His/x name/s is/v Can/o .' },
    '2-ev': { s: 'The_cat/s is/v in/o the_kitchen/o .' }, '2-sehir': { s: 'Do/q you/s like/v bread/o ?' },
    '3-okul': { s: 'You/s mustn\'t/v run/v !' }, '3-sinif': { s: 'There_are/v two/o rulers/o .' }, '3-kisisel': { s: 'I/s am/v wear+ing/v a_T-shirt/o .', z: 'simdi' }, '3-aile': { s: 'She/s cook+s/v every_day/x .', z: 'her' },
    '3-ciftlik': { s: 'The_hens/s are/v eat+ing/v corn/o .', z: 'simdi' }, '3-sehir': { s: 'I/s want/v some/x salad/o .' },
    '4-okul': { s: 'I/s always/x read/v books/o .', z: 'her' }, '4-sinif': { s: 'It/s is>was/v fun/o .', z: 'dun' }, '4-kisisel': { s: 'I/s play+ed/v games/o yesterday/x .', z: 'dun' }, '4-aile': { s: 'She/s is/v the/x kind+est/x .' },
    '4-deniz': { s: 'It/s will/v be/v sunny/o .', z: 'yarin' }, '4-sehir': { s: 'We/s are/v going_to/v go/v to_Italy/o .', z: 'yarin' }
  };
  function acikMi() { return ACIK || !!W.KIDS_EKIP; }
  W.KIDS_CUMLE4 = { GRAMER: GRAMER, EKC: EKC, KA: KA, acikMi: acikMi };
})(window);
