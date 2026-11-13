/* ==========================================================================
   ACADEX KIDS · seslendirme kataloğu (kids/ses/katalog.js), 10.11.2026
   Sitenin sesli söylediği HER cümle burada üretilir: konu paketlerinden (kelimeler,
   şarkılar, oyun cümleleri) ve aşağıdaki sabit Türkçe yönergelerden.
   Anahtar = dil + ':' + metin (kids-ses.js de aynı anahtarla dosyayı bulur).
   Yeni bir SES.soyle('...') cümlesi eklendiğinde buraya da eklenir; tests/kids-ses.js
   kaynaktaki sabit cümlelerin burada olduğunu denetler.
   Kullanım (Node): require('./katalog.js')() → [{dil, metin, not}]
   ========================================================================== */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const A = path.join(__dirname, '..', 'assets');

/* sitenin kendi modüllerini yükle: katalog asla koddan ayrı düşmesin */
function modulleriYukle() {
  const W = { document: {}, addEventListener() {}, matchMedia: () => ({ matches: false }), KIDS_SES: {} };
  W.window = W;
  const ctx = vm.createContext({ window: W, localStorage: { getItem: () => null, setItem() {} }, console });
  for (const f of ['kids-ciz.js', 'kids-resim.js', 'kids-resim2.js', 'kids-resim3.js', 'kids-veri.js', 'kids-konu.js', 'kids-temalar.js', 'kids-temalar2.js', 'kids-temalar3.js', 'kids-oyun.js', 'kids-oyun2.js', 'kids-park.js', 'kids-kitap.js']) vm.runInContext(fs.readFileSync(path.join(A, f), 'utf8'), ctx);
  return W;
}

/* Türkçe yönergeler (sabit) */
const TR = [
  'Hangi sınıftasın?', 'Sen hangisisin? Resmine dokun.', 'Gizli iki resmine sırayla dokun.', 'Biraz dinlenelim; birkaç dakika sonra yeniden dene.',
  'Okulunuzun Acadex Kids lisansı açık değil.', 'Bu ada yakında açılacak.', 'Bugün serbest gün. İstediğin adaya dokun.',
  'Mola zamanı! Bugün çok güzel çalıştın.', 'Dolabına yeni bir şey geldi!', 'Hadi birlikte şarkı söyleyelim!',
  'Dolabına hoş geldin! Yıldız topladıkça yeni şeyler açılır.', 'Yeni bir rozet kazandın!', 'Kitaplığa hoş geldin! Bir kitap seç.', 'Adan büyüdü!', 'Hadi bir sahne kuralım!', 'Önce bir önceki paketi bitir.', 'Yeni bir kelime paketi açıldı!', 'Gümüş madalya kazandın!', 'Altın madalya kazandın!'
];
const EN = ['Good try!', 'Well done!', 'Super!', 'Let\'s count together!', 'Simon says!', 'What is it?', 'The end! Great reading!'];

module.exports = function katalog() {
  const W = modulleriYukle(), V = W.KIDS_VERI, K = W.KIDS_KONU, O = W.KIDS_OYUN, liste = new Map();
  const ekle = (dil, metin, not) => { metin = String(metin).trim().replace(/\s+/g, ' '); const k = dil + ':' + metin; if (!liste.has(k)) liste.set(k, { dil, metin, not: not || '' }); };
  TR.forEach((m) => ekle('tr', m, 'yönerge'));
  EN.forEach((m) => ekle('en', m, 'övgü / oyun'));
  V.GIYSI.forEach((g) => ekle('tr', g.tema ? V.konuBul(g.tema).tr + ' adasını bitirince açılacak.' : g.yildiz + ' yıldız toplayınca açılacak.', 'dolap'));
  V.KONU.filter((k) => k.acik).forEach((k) => ekle('tr', 'Bugünün konusu ' + k.tr.toLocaleLowerCase('tr') + '. Hadi oynayalım!', 'harita'));
  for (const id of K.PAKET) {
    const P = K.al(id), hepsi = K.hepsi(id);
    ekle('en', P.izleGiris, id + ' · izle'); ekle('tr', P.dokunYon, id + ' · dokun'); ekle('en', P.hafiza.soz, id + ' · hafıza'); ekle('en', P.bitis, id + ' · bitiş');
    hepsi.forEach((o) => {
      ekle('en', o.en, id + ' · kelime'); ekle('en', o.en + '.', id + ' · izle'); ekle('en', o.en + '!', id + ' · balon doğru');
      ekle('en', P.izleCumle(o), id + ' · izle'); ekle('en', 'Say: ' + o.en, id + ' · söyle'); ekle('en', P.balon.soz(o), id + ' · balon');
      if (!P.balon.yanlis) hepsi.forEach((y) => { if (y !== o) ekle('en', 'That is ' + y.en + '. Find ' + o.en + '!', id + ' · balon yanlış'); });
      /* akıllı tahta: Simon says komutu */
      ekle('en', K.komut(P, o), id + ' · akıllı tahta');
    });
    P.sarki.forEach((s) => {
      ekle('en', s.soz, id + ' · şarkı');
      s.soz.split(' ').forEach((w) => { const t = w.toLowerCase().replace(/[^a-z']/g, ''); if (t) ekle('en', t, id + ' · şarkı kelimesi'); });
    });
    P.ev.forEach((c) => ekle('en', c[0], id + ' · veli köşesi'));
    if (O.cumleler) O.cumleler(P).forEach((m) => ekle('en', m, id + ' · ' + P.oyun3.ad));
    if (O.karisikParca) O.karisikParca(P).forEach((m) => ekle('en', m, id + ' · karışık'));
  }
  /* Colours · boyama */
  O.BOYA_GOREV.forEach((g) => { ekle('en', 'Colour the ' + g[0] + ' ' + g[1] + '.', 'colours · boyama'); ekle('en', g[1] + ' ' + g[0] + '!', 'colours · boyama doğru'); });
  /* Numbers · say */
  O.SAY_NESNE.forEach((n) => ekle('en', 'How many ' + n[1] + '?', 'numbers · say'));
  V.SAYI.forEach((s) => {
    ekle('en', V.SAYI.slice(0, s.n).map((x) => x.en).join(', '), 'numbers · birlikte say');
    O.SAY_NESNE.forEach((n) => ekle('en', O.sayCevap(s, n), 'numbers · say doğru'));
  });
  /* oyun parkı ve anlatım */
  (O.parkCumleler || []).forEach((m) => ekle('en', m, 'park / anlatım'));
  /* sahne kur: sayılabilir her kelimenin çoğulu ("two" + "cats!") */
  ['Pick a picture!', 'Big!', 'Small!', 'Great picture!'].forEach((m) => ekle('en', m, 'sahne kur'));
  for (const id of K.PAKET) K.hepsi(id).filter(W.KIDS_TEMALAR.karisikUygun).forEach((x) => ekle('en', W.KIDS_TEMALAR.cogul(x) + '!', 'sahne kur · çoğul'));
  /* harf treni: kelime (ABC'de örnek kelime) noktalı ve ünlemli */
  for (const id of K.PAKET) K.al(id).ogeler({ kelimeSay: 99, renkSay: 99, sayiSay: 99 }).filter(O.harfUygun || (() => false)).forEach((x) => { const w = x.kelime || x.en; ekle('en', w + '.', 'harf treni'); ekle('en', w + '!', 'harf treni'); });
  /* hikâye kitaplığı: cümleler, tek tek kelimeler (dokununca), sorular */
  for (const b of W.KIDS_KITAP.LISTE) {
    ekle('en', b.ad, 'kitap · ' + b.id);
    b.sayfalar.forEach((s) => { ekle('en', s.s, 'kitap · ' + b.id); W.KIDS_KITAP.kelimeler(s.s).forEach((w) => ekle('en', w, 'kitap kelimesi')); });
    b.sorular.forEach((q) => ekle('en', q.s, 'kitap · soru'));
  }
  return [...liste.values()];
};

if (require.main === module) {
  const l = module.exports(), kar = l.reduce((t, x) => t + x.metin.length, 0);
  console.log(l.length + ' cümle, ' + kar + ' karakter (en: ' + l.filter((x) => x.dil === 'en').length + ', tr: ' + l.filter((x) => x.dil === 'tr').length + ')');
}
