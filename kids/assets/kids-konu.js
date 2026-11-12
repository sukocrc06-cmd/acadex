/* ==========================================================================
   ACADEX KIDS · konu paketleri (kids/assets/kids-konu.js), 10.11.2026
   Bir konuyu oynanabilir yapan her şey burada: kelimeler (yaşa göre), çizimi,
   Acadia'nın cümleleri, üçüncü oyun, şarkı ve veliye "evde söyleyin" cümleleri.
   Yeni konu eklemek = buraya (ya da kids-temalar.js'e, KIDS_KONU.ekle ile) bir paket
   + KIDS_VERI.KONU'da acik:true. etkinlik: veli köşesinin "evde 5 dakika" kartları.
   Şarkı sözleri Acadex için yazıldı (alıntı değil).
   W.KIDS_KONU.al(konuId) → paket
   ========================================================================== */
(function (W) {
  'use strict';
  var C = W.KIDS_CIZ, V = W.KIDS_VERI;

  var P = {
    colours: {
      id: 'colours',
      ogeler: function (bant) { return V.RENK.slice(0, bant.renkSay); },
      gorsel: function (o) { return C.leke(o.hex); },
      izleGiris: 'Let\'s learn colours!',
      izleCumle: function (o) { return 'It\'s ' + o.en + '!'; },
      dokunYon: 'Renklere dokun ve dinle.',
      balon: { soz: function (o) { return 'Pop the ' + o.en + ' balloon!'; }, html: function (o) { return 'Pop the <b style="--r:' + o.hex + '">' + o.en + '</b> balloon!'; }, ciz: function (o) { return C.balon(o.hex); } },
      hafiza: { soz: 'Find the same colours!', a: function (o) { return C.leke(o.hex); }, b: function (o, bant) { return bant.kelimeKart ? '<b lang="en" style="--r:' + o.hex + '">' + o.en + '</b>' : C.leke(o.hex); } },
      oyun3: { id: 'boyama', ad: 'Boyama', simge: 'firca' },
      cikartma: ['gokkusagi', 'firca', 'yildiz'],
      sarki: [
        { kim: 'red', soz: 'Red, red, the apple is red.' },
        { kim: 'yellow', soz: 'Yellow, yellow, the sun is yellow.' },
        { kim: 'blue', soz: 'Blue, blue, the sea is blue.' },
        { kim: 'green', soz: 'Green, green, the frog is green.' },
        { kim: 'orange', soz: 'Orange and purple, look at me!' },
        { kim: null, soz: 'Colours, colours, one, two, three!' }
      ],
      ev: [['What colour is it?', 'Bu ne renk?'], ['It\'s red!', 'Kırmızı!'], ['I like blue.', 'Maviyi severim.']],
      etkinlik: [{ ad: 'Renk avı', adim: 'Evde bir renk söyleyin: “Find red!” Çocuğunuz o renkte bir eşya bulup getirsin ve söylesin: “Red!” Sonra sıra onda.' },
        { ad: 'Giysi renkleri', adim: 'Giyinirken sorun: “What colour is it?” Çocuğunuz tişörtünün, çorabının rengini İngilizce söylesin.' }],
      bitis: 'Great job! Colours, done!'
    },
    numbers: {
      id: 'numbers',
      ogeler: function (bant) { return V.SAYI.slice(0, bant.sayiSay || 10); },
      gorsel: function (o) { return C.sayiKart(o.n, o.hex); },
      izleGiris: 'Let\'s count!',
      izleCumle: function (o) { return o.n <= 5 ? 'Count with me: ' + V.SAYI.slice(0, o.n).map(function (x) { return x.en; }).join(', ') + '!' : 'It\'s ' + o.en + '!'; },
      dokunYon: 'Sayılara dokun ve dinle.',
      balon: { soz: function (o) { return 'Pop number ' + o.en + '!'; }, html: function (o) { return 'Pop number <b style="--r:' + o.hex + '">' + o.en + '</b>!'; }, ciz: function (o) { return C.sayiBalon(o.n, o.hex); } },
      hafiza: { soz: 'Find the pairs!', a: function (o) { return C.sayiKart(o.n, o.hex); }, b: function (o, bant) { return bant.kelimeKart ? '<b lang="en" style="--r:' + o.hex + '">' + o.en + '</b>' : C.noktalar(o.n, o.hex); } },
      oyun3: { id: 'say', ad: 'Say', simge: 'elma' },
      cikartma: ['top', 'balik', 'cilek'],
      sarki: [
        { kim: 'three', soz: 'One, two, three, count with me!' },
        { kim: 'five', soz: 'Four and five, give me a high five!' },
        { kim: 'seven', soz: 'Six and seven, reach the sky!' },
        { kim: 'ten', soz: 'Eight, nine, ten, let\'s count again!' },
        { kim: null, soz: 'Numbers, numbers, one to ten!' }
      ],
      ev: [['How many?', 'Kaç tane?'], ['One, two, three!', 'Bir, iki, üç!'], ['I am five.', 'Ben beş yaşındayım.']],
      etkinlik: [{ ad: 'Merdiven sayma', adim: 'Merdiven çıkarken ya da sofrayı kurarken birlikte sayın: “One, two, three…” Çocuğunuz sayıyı yüksek sesle söylesin.' },
        { ad: 'Parmak sayısı', adim: 'Birkaç parmak gösterin: “How many?” Çocuğunuz sayıp İngilizce söylesin. Sonra o göstersin, siz sayın.' }],
      bitis: 'Great job! Numbers, done!'
    }
  };
  /* şarkı satırları: yaş dünyasında olmayan kelimenin satırı atlanır */
  function sarkiSatir(p, ogeler) {
    var var_ = {}; ogeler.forEach(function (o) { var_[o.id] = 1; });
    return p.sarki.filter(function (s) { return !s.kim || var_[s.kim]; });
  }
  var PAKET = Object.keys(P);
  /* kids-temalar.js on temayı buradan ekler; KIDS_VERI.KONU sırası korunur */
  function ekle(id, paket) { P[id] = paket; if (PAKET.indexOf(id) < 0) PAKET.push(id); var sira = V.KONU.map(function (k) { return k.id; }); PAKET.sort(function (a, b) { return sira.indexOf(a) - sira.indexOf(b); }); }
  /* akıllı tahta "Simon says" komutu: My Body'de kendi vücudun, öbürlerinde tahtadaki resim */
  var BELIRLI = { family: { baby: 1, family: 1, boy: 1, girl: 1, man: 1, woman: 1, friend: 1, parents: 1, twins: 1, pet: 1 }, colours: 0, numbers: 0, weather: 0, feelings: 0, seasons: 0 };
  function komut(p, o) {
    if (p.id === 'body') return 'Touch your ' + o.en + '!';
    if (p.id === 'numbers') return 'Point to number ' + o.en + '!';
    if (p.id === 'places') return o.cumle;
    if (p.id === 'alphabet') return 'Point to the letter ' + o.en + '!';
    if (p.id === 'days') return 'Point to ' + o.en + '!';
    if (p.id === 'actions') return 'Can you ' + o.en + '?';
    var b = BELIRLI[p.id]; return 'Point to ' + (b === 0 || (b && !b[o.id]) ? '' : 'the ') + o.en.toLowerCase() + '!';
  }
  /* konunun oyun sayısı ve en çok yıldızı: üç oyun + (varsa) karışık durak */
  function oyunSay(id) { var p = P[id]; return 3 + (p && p.karisik ? 1 : 0); }
  W.KIDS_KONU = { al: function (id) { return P[id] || null; }, sarkiSatir: sarkiSatir, PAKET: PAKET, ekle: ekle, komut: komut, oyunSay: oyunSay, yildizMax: function (id) { return 3 * oyunSay(id); } };
})(window);
