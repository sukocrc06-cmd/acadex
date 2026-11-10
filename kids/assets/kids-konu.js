/* ==========================================================================
   ACADEX KIDS · konu paketleri (kids/assets/kids-konu.js), 10.11.2026
   Bir konuyu oynanabilir yapan her şey burada: kelimeler (yaşa göre), çizimi,
   Acadia'nın cümleleri, üçüncü oyun, şarkı ve veliye "evde söyleyin" cümleleri.
   Yeni konu eklemek = buraya bir paket + KIDS_VERI.KONU'da acik:true.
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
      bitis: 'Great job! Numbers, done!'
    }
  };
  /* şarkı satırları: yaş dünyasında olmayan kelimenin satırı atlanır */
  function sarkiSatir(p, ogeler) {
    var var_ = {}; ogeler.forEach(function (o) { var_[o.id] = 1; });
    return p.sarki.filter(function (s) { return !s.kim || var_[s.kim]; });
  }
  W.KIDS_KONU = { al: function (id) { return P[id] || null; }, sarkiSatir: sarkiSatir, PAKET: Object.keys(P) };
})(window);
