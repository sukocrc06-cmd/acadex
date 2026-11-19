/* ==========================================================================
   ACADEX KIDS · TÜRKÇE MASALLAR (kids/assets/kids-masal.js), 20.11.2026
   Küçük çocuklar için: Acadia masalı TÜRKÇE anlatır, yalnız öğreteceği kelimeyi İngilizce söyler.
     "Dede arabaya binecek ama yollar çok kalabalık!"
     → "Araba, İngilizce… car!"  → "Hadi sen de söyle!"  → çocuk "car" der → "Aferin!"
   Her konuya bir masal (22), 6 sayfa: 5 sayfada birer hedef kelime, son sayfa mutlu son.
   Mikrofon (veli açtıysa, kids-dinle.js) çocuğun söylediğini anlar; iki denemede olmazsa
   "Çok güzel deneme!" deyip kelimeyi bir kez daha söyler ve devam eder. Mikrofon yoksa
   "Söyledim!" düğmesi. Sonunda 3 soru: "Hangisi car?" → resme dokun ya da söyle.
   Sayfa: [metin, hedef, [resimler]]  · metinde *yıldızlı* kısım hedef kelimenin geçtiği yer (vurgulanır)
   Okunan masal il.kitap['m-…'] olarak işlenir (kitaplıkta ✓). Hikâyeler Acadex için yazıldı.
   W.KIDS_MASAL = { LISTE, ac(o, id), cumleler(), duzMetin }
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, C = W.KIDS_CIZ, R = W.KIDS_RESIM, V = W.KIDS_VERI, SES = W.KIDS_SES;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function m(id, konu, ad, sayfalar) { return { id: 'm-' + id, konu: konu, ad: ad, sayfalar: sayfalar.map(function (x) { return { s: x[0], k: x[1] || null, r: x[2] || [] }; }) }; }

  var LISTE = [
    m('top', 'colours', 'Topum Nerede?', [
      ['Minik kedi Pamuk\'un *kırmızı* bir topu var.', 'red', ['cat', 'ball']],
      ['Ama top kayboldu! Pamuk *mavi* çantaya bakıyor. Yok!', 'blue', ['cat', 'bag']],
      ['*Sarı* sandalyenin altında mı? Orada da yok!', 'yellow', ['chair']],
      ['*Yeşil* çimenlerde arıyor. Hâlâ yok!', 'green', ['cat', 'sad']],
      ['Bak! Köpek Karabaş, *turuncu* yastığın arkasından topu getirdi.', 'orange', ['dog', 'ball']],
      ['Pamuk ile Karabaş birlikte top oynuyor. Yaşasın!', null, ['cat', 'dog', 'happy']]]),
    m('civciv', 'numbers', 'Üç Aç Civciv', [
      ['Tavuk annenin *üç* küçük civcivi var. Cik cik cik, çok açlar!', 'three', ['hen', 'chick', 'chick', 'chick']],
      ['Ağaçtan *bir* elma düştü. Pat!', 'one', ['apple']],
      ['Sonra *iki* elma daha düştü. Pat, pat!', 'two', ['apple', 'apple']],
      ['Rüzgâr esti, *dört* elma birden düştü!', 'four', ['apple', 'apple', 'apple', 'apple']],
      ['Civcivler saydı: tam *beş* elma! Herkese yeter.', 'five', ['chick', 'apple']],
      ['Civcivlerin karnı doydu. Teşekkürler, ağaç!', null, ['chick', 'happy']]]),
    m('kopek', 'animals', 'Köpeğim Nerede?', [
      ['Ali *köpeğini* bulamıyor. Çok üzgün.', 'dog', ['boy', 'sad']],
      ['Ahırda bir *inek* var. Möö! Sen misin? Hayır!', 'cow', ['cow']],
      ['Gölde bir *ördek* yüzüyor. Vak vak! O da değil.', 'duck', ['duck']],
      ['Çitin üstünde bir *kedi* oturuyor. Miyav! Hayır!', 'cat', ['cat']],
      ['Çalılardan bir *tavşan* zıpladı. Arkasında kim var? Hav hav!', 'rabbit', ['rabbit', 'dog']],
      ['Ali köpeğine sarıldı. Seni çok seviyorum!', null, ['boy', 'dog', 'happy']]]),
    m('pasta', 'family', 'Büyükanneye Pasta', [
      ['Bugün *büyükannenin* doğum günü.', 'grandma', ['grandma']],
      ['*Annem* kocaman bir pasta yapıyor.', 'mum', ['mum', 'cake']],
      ['Eyvah! *Bebek* pastaya uzanıyor. Dur bebek, dur!', 'baby', ['baby', 'cake']],
      ['*Babam* bebeği kucağına alıyor.', 'dad', ['dad', 'baby']],
      ['*Büyükbabam* mumları yakıyor. Sürpriz!', 'grandpa', ['grandpa', 'cake']],
      ['Herkes pasta yiyor. İyi ki doğdun, büyükanne!', null, ['grandma', 'cake', 'happy']]]),
    m('yika', 'body', 'Yıka, Yıka, Yıka!', [
      ['Tavşan Pıtırcık çamura düştü. *Elleri* çamur oldu!', 'hands', ['rabbit', 'hands']],
      ['Hadi *yüzünü* yıkayalım. Şırıl şırıl!', 'face', ['face']],
      ['Şimdi sıra *burnunda*. Pof!', 'nose', ['nose']],
      ['Uzun *kulaklarını* da yıkıyor.', 'ears', ['rabbit', 'ears']],
      ['En son *ayaklarını* yıkıyor. Tertemiz!', 'feet', ['feet']],
      ['Pıtırcık mis gibi kokuyor. İyi geceler!', null, ['rabbit', 'bed']]]),
    m('ayi', 'food', 'Aç Ayı Boncuk', [
      ['Ayı Boncuk çok aç. Önce bir *elma* yedi. Kıtır kıtır!', 'apple', ['bear', 'apple']],
      ['Sonra bir dilim *ekmek* yedi.', 'bread', ['bread']],
      ['Ekmeğin yanına biraz *peynir*.', 'cheese', ['cheese']],
      ['Bir bardak *süt* içti. Lık lık lık!', 'milk', ['milk']],
      ['En son kocaman bir *pasta*! Mmm!', 'cake', ['bear', 'cake']],
      ['Boncuk\'un karnı doydu, uykusu geldi. Iyy, ne çok yedin!', null, ['bear', 'sleepy']]]),
    m('ayicik', 'toys', 'Ayıcığım Nerede?', [
      ['Ela *oyuncak ayısını* arıyor.', 'teddy', ['girl', 'sad']],
      ['*Topun* arkasında mı? Yok.', 'ball', ['ball']],
      ['*Robotun* yanında mı? Yok.', 'robot', ['robot']],
      ['*Trenin* vagonunda mı? O da yok!', 'train', ['train']],
      ['*Uçurtmanın* altında bir şey kıpırdıyor... Ayıcık!', 'kite', ['kite', 'teddy']],
      ['Ela ayıcığına sarıldı. İyi geceler, ayıcık!', null, ['girl', 'teddy', 'sleepy']]]),
    m('kar', 'clothes', 'Karlı Gün', [
      ['Dışarıda kar var! Ali *montunu* giyiyor.', 'coat', ['boy', 'coat']],
      ['Sonra *çizmelerini* giyiyor.', 'boots', ['boots']],
      ['Ellerine *eldiven* takıyor.', 'gloves', ['gloves']],
      ['Başına da *şapka*.', 'hat', ['hat']],
      ['Boynuna *atkı* doluyor. Şimdi sıcacık!', 'scarf', ['boy', 'scarf']],
      ['Ali kocaman bir kardan adam yaptı.', null, ['boy', 'snowman', 'happy']]]),
    m('kedi', 'home', 'Uykucu Tekir', [
      ['Kedi Tekir uyumak istiyor. *Kanepeye* yatıyor ama televizyon çok gürültülü!', 'sofa', ['cat', 'sofa']],
      ['*Mutfakta* buzdolabı vınlıyor.', 'kitchen', ['kitchen']],
      ['*Küvette* damlalar şıp şıp şıp!', 'bath', ['bath']],
      ['*Masanın* altı çok karanlık.', 'table', ['table']],
      ['Sonunda yumuşacık bir *yatak* buluyor.', 'bed', ['cat', 'bed']],
      ['Şşş! Tekir uyuyor. İyi geceler!', null, ['cat', 'sleepy']]]),
    m('okul', 'school', 'Okulda İlk Gün', [
      ['Bugün okulun ilk günü. Ali *çantasını* aldı.', 'bag', ['boy', 'bag']],
      ['Sınıfa girdi, *sırasına* oturdu.', 'desk', ['desk']],
      ['Eyvah, *kalemi* yok!', 'pencil', ['pencil', 'sad']],
      ['Ela ona kalem verdi. Ali de ona *silgisini* verdi.', 'eraser', ['girl', 'eraser']],
      ['Birlikte *pastel boyalarla* resim yaptılar.', 'crayons', ['crayons']],
      ['Ali\'nin yeni bir arkadaşı oldu. Okul çok güzel!', null, ['boy', 'girl', 'happy']]]),
    m('semsiye', 'weather', 'Uçan Şemsiye', [
      ['Bugün hava *yağmurlu*. Ördek Paytak dışarı çıkıyor.', 'rainy', ['duck', 'rainy']],
      ['Paytak kırmızı *şemsiyesini* açtı.', 'umbrella', ['duck', 'umbrella']],
      ['Vuuu! *Rüzgâr* şemsiyeyi uçurdu!', 'wind', ['wind', 'umbrella']],
      ['Şemsiye bir *bulutun* üstüne kondu.', 'cloud', ['cloud', 'umbrella']],
      ['Sonra *güneş* çıktı, rüzgâr durdu.', 'sun', ['sun']],
      ['Şemsiye süzülerek geri geldi. Bak, bir de *gökkuşağı*!', 'rainbow', ['umbrella', 'rainbow', 'happy']]]),
    m('aslan', 'feelings', 'Küçük Aslan', [
      ['Küçük Aslan bir kule yaptı. Çok *mutlu*!', 'happy', ['lion', 'blocks']],
      ['Güm! Kule yıkıldı. Aslan çok *şaşırdı*.', 'surprised', ['blocks', 'surprised']],
      ['Sonra çok *kızdı*: Grrr!', 'angry', ['lion', 'angry']],
      ['Biraz da *üzüldü*, ağladı.', 'sad', ['sad']],
      ['Annesi dedi ki: Derin nefes al. Aslan *sakinleşti*.', 'calm', ['mum', 'calm']],
      ['Yeni bir kule yaptı. Aslan şimdi çok *gururlu*!', 'proud', ['lion', 'blocks', 'proud']]]),
    m('karpuz', 'fruits', 'Kocaman Karpuz', [
      ['Ela annesiyle pazara gitti. Orada kocaman bir *karpuz* var!', 'watermelon', ['girl', 'watermelon']],
      ['Annesi üç tane *portakal* aldı.', 'orangefruit', ['orangefruit', 'orangefruit', 'orangefruit']],
      ['Bir salkım *üzüm* aldı.', 'grapes', ['grapes']],
      ['Sapsarı bir *limon* aldı.', 'lemon', ['lemon']],
      ['Bir de tatlı tatlı *kiraz*.', 'cherries', ['cherries']],
      ['Babası ağır karpuzu taşıdı. Hep birlikte yediler. Mmm!', null, ['dad', 'watermelon', 'happy']]]),
    m('dede', 'transport', 'Dede Yolda', [
      ['Dede bize pasta getiriyor. Önce *otobüse* biniyor.', 'bus', ['grandpa', 'bus']],
      ['Eyvah, otobüs bozuldu! Dede *arabaya* binecek ama yollar çok kalabalık!', 'car', ['car']],
      ['Önlerinde kocaman bir *kamyon* var. Düt düt!', 'truck', ['truck']],
      ['Dede bir *bisiklete* bindi. Zırr zırr!', 'bike', ['grandpa', 'bike']],
      ['Gökyüzünde bir *uçak* ona el salladı.', 'plane', ['plane']],
      ['Dede geldi! Pasta da sapasağlam. İyi ki doğdun!', null, ['grandpa', 'cake', 'happy']]]),
    m('kare', 'shapes', 'Küçük Kare', [
      ['Küçük *Kare* üzgün; yuvarlanamıyor.', 'square', ['square', 'sad']],
      ['*Daire* tepeden yuvarlanıyor. Vıııı!', 'circle', ['circle']],
      ['*Üçgen* diyor ki: Sen çok güçlüsün, gel bir ev yapalım!', 'triangle', ['triangle']],
      ['Kare duvar oluyor, *dikdörtgen* de kapı.', 'rectangle', ['square', 'rectangle']],
      ['Gece evin üstünde bir *yıldız* parlıyor.', 'star', ['star']],
      ['Bak, ne güzel bir ev! Kare artık çok mutlu.', null, ['square', 'triangle', 'happy']]]),
    m('kabuk', 'sea', 'Kayıp Kabuk', [
      ['Küçük *yengeç* ağlıyor; kabuğunu kaybetmiş.', 'crab', ['crab', 'sad']],
      ['*Ahtapot* diyor ki: Ben yardım ederim!', 'octopus', ['octopus']],
      ['*Kaplumbağaya* soruyorlar. Onda yok.', 'turtle', ['turtle']],
      ['*Denizyıldızına* soruyorlar. Onda da yok.', 'starfish', ['starfish']],
      ['Kocaman bir *köpekbalığı* geliyor... Ağzında kabuk var!', 'shark', ['shark', 'shell']],
      ['Teşekkürler köpekbalığı! Artık hepsi arkadaş.', null, ['crab', 'shell', 'happy']]]),
    m('kedi-agac', 'jobs', 'Ağaçtaki Kedi', [
      ['Bir kedicik ağaçta kalmış. Onu ilk *aşçı* gördü, balık getirdi.', 'chef', ['chef', 'cat']],
      ['Sonra *doktor* geldi: Korkma, kedicik!', 'doctor', ['doctor']],
      ['*Polis* yoldaki arabaları durdurdu.', 'police', ['police']],
      ['*İtfaiyeci* uzun merdivenle yukarı tırmandı.', 'firefighter', ['firefighter']],
      ['Kedicik indi. *Veteriner* baktı: Çok iyi!', 'vet', ['vet', 'cat']],
      ['Herkes alkışladı. Yaşasın!', null, ['cat', 'happy']]]),
    m('maymun', 'actions', 'Uçmak İsteyen Maymun', [
      ['Maymun Cimcime kuş gibi *uçmak* istiyor.', 'fly', ['monkey', 'bird']],
      ['*Zıplıyor*, zıplıyor ama uçamıyor.', 'jump', ['monkey', 'jump']],
      ['Hızlı hızlı *koşuyor*. Yine uçamıyor.', 'run', ['run']],
      ['En yüksek ağaca *tırmanıyor*.', 'climb', ['climb']],
      ['Kuş diyor ki: Ben tırmanamam! Gel birlikte *dans* edelim!', 'dance', ['bird', 'dance']],
      ['Cimcime ile kuş ağaçta birlikte oynuyor.', null, ['monkey', 'bird', 'happy']]]),
    m('tohum', 'seasons', 'Küçük Tohum', [
      ['Küçük tohum karın altında uyuyor. Mevsim *kış*.', 'winter', ['winter', 'snowflake']],
      ['*İlkbaharda* güneş seslendi: Uyan, küçük tohum!', 'spring', ['spring', 'sun']],
      ['Tohumdan yeşil bir *yaprak* çıktı.', 'leaf', ['leaf']],
      ['Yazın tohum kocaman sarı bir *çiçek* oldu.', 'flower', ['summer', 'flower']],
      ['*Sonbaharda* rüzgâr esti, yeni tohumlar uçtu.', 'autumn', ['autumn', 'wind']],
      ['Kış yine geldi. İyi uykular, küçük tohumlar!', null, ['winter', 'sleepy']]]),
    m('havuc', 'days', 'Tavşanın Havucu', [
      ['*Pazartesi* tavşan bir havuç tohumu ekti.', 'monday', ['rabbit', 'carrot']],
      ['*Salı* yağmur yağdı, tohum su içti.', 'tuesday', ['rain']],
      ['*Çarşamba* küçük bir yaprak çıktı.', 'wednesday', ['leaf']],
      ['*Perşembe* güneş açtı, havuç büyüdü.', 'thursday', ['sunny']],
      ['*Cuma* tavşan çekti: Hop! Kocaman bir havuç!', 'friday', ['rabbit', 'carrot']],
      ['Cumartesi havuçlu kek yaptı, pazar günü arkadaşlarıyla yedi.', null, ['rabbit', 'cake', 'happy']]]),
    m('saklambac', 'places', 'Saklambaç', [
      ['Köpek sayıyor, kedi saklanıyor. Kedi masanın *altında* mı? Yok!', 'under', ['table', 'dog']],
      ['Kapının *arkasında* mı? Yok!', 'behind', ['door']],
      ['Çantanın *içinde* mi? Yok!', 'in', ['bag']],
      ['Kanepenin *üstünde* mi? Yok!', 'on', ['sofa']],
      ['Yatağın *yanında* bir kuyruk görünüyor!', 'next', ['bed', 'cat']],
      ['Buldum seni! Şimdi sıra sende, kedicik.', null, ['dog', 'cat', 'happy']]]),
    m('harf', 'alphabet', 'Harf Avı', [
      ['A harfi bir *elma* buldu. A, elmanın harfi!', 'apple', ['harf-a', 'apple']],
      ['B harfi bir *top* buldu.', 'ball', ['harf-b', 'ball']],
      ['C harfi bir *kedi* buldu. Miyav!', 'cat', ['harf-c', 'cat']],
      ['D harfi bir *köpek* buldu. Hav hav!', 'dog', ['harf-d', 'dog']],
      ['E harfi bir *yumurta* buldu.', 'egg', ['harf-e', 'egg']],
      ['Harfler el ele verdi: A, B, C, D, E! Ne güzel!', null, ['harf-a', 'harf-b', 'harf-c']]])
  ];

  function oge(id) { return V.ogeBul ? V.ogeBul(id) : null; }
  function en(id) { var x = oge(id); return x ? (x.kelime || x.en) : id; }
  function trAd(id) { var x = oge(id); var t = x ? String(x.tr || x.en) : id; return t.charAt(0).toLocaleUpperCase('tr') + t.slice(1); }
  function duzMetin(s) { return String(s).replace(/\*/g, ''); }
  function vurgulu(s) { return esc(s).replace(/\*([^*]+)\*/g, '<mark class="km-vurgu">$1</mark>'); }
  function gorsel(id) { return W.KIDS_KITAP ? W.KIDS_KITAP.gorsel(id) : R.ciz(id); }
  function hedefler(b) { return b.sayfalar.map(function (x) { return x.k; }).filter(Boolean); }
  var bekle = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var OVGU = ['Aferin!', 'Süpersin!', 'Harika!'];

  /* katalog (kids/ses/katalog.js): masalın söylediği her cümle */
  function cumleler() {
    var tr = ['Hadi sen de söyle!', 'Aferin!', 'Süpersin!', 'Harika!', 'Hangisi', 'Masal bitti! Bugün yeni kelimeler öğrendin.', 'Bir masal seç, Acadia sana okusun.'], en2 = [];
    LISTE.forEach(function (b) {
      tr.push(b.ad);
      b.sayfalar.forEach(function (s) { tr.push(duzMetin(s.s)); if (s.k) { tr.push(trAd(s.k) + ', İngilizce'); en2.push(en(s.k) + '!'); en2.push(en(s.k) + '?'); } });
    });
    return { tr: tr, en: en2 };
  }

  /* ---------------- okuma ---------------- */
  var S = null;
  function ac(o, id, n) {
    S = o; n = n || 0;
    var b = LISTE.filter(function (x) { return x.id === id; })[0]; if (!b) return;
    var kz = V.konuBul(b.konu), iptal = false, son = n >= b.sayfalar.length;
    if (W.KIDS_DINLE) W.KIDS_DINLE.durdur(); SES.sus(); W.scrollTo(0, 0);
    var nokta = '<ol class="kk-noktalar">' + b.sayfalar.map(function (x, i) { return '<li class="' + (i === n ? 'kk-bu' : i < n ? 'kk-gecti' : '') + '"></li>'; }).join('') + '<li class="' + (son ? 'kk-bu' : '') + '">?</li></ol>';
    var ust = '<div class="ka-dunya" aria-hidden="true">' + R.dunya(b.konu) + '</div><header class="ka-konu-ust"><button type="button" class="ka-yuvarlak" data-kraf aria-label="Kitaplığa dön">' + C.simge('book') + '</button>' + nokta + '<button type="button" class="ka-yuvarlak" data-koku aria-label="Yeniden oku">' + C.simge('ses') + '</button></header>';
    if (son) return sorular(b, 0, 0, ust);
    var sf = b.sayfalar[n], h = sf.k;
    o.kok.innerHTML = ust + '<main class="ka-sahne kk-sayfa km-sayfa" style="--r:' + kz.renk + '"><h2 class="kk-ad">' + esc(b.ad) + '</h2>' +
      '<div class="kk-resim kk-r' + sf.r.length + '">' + sf.r.map(function (r, i) { return '<button type="button" class="kk-rb" data-kr="' + r + '" style="--i:' + i + '" aria-label="' + esc(trAd(r)) + '">' + gorsel(r) + '</button>'; }).join('') + '<span class="kk-acd">' + C.acadia({ mood: 'mutlu' }) + '</span></div>' +
      '<p class="kk-cumle km-cumle">' + vurgulu(sf.s) + '</p>' +
      (h ? '<div class="km-kelime" data-kmk hidden><button type="button" class="km-kart" data-kmdinle aria-label="' + esc(en(h)) + ' — dinle"><span class="km-kres">' + gorsel(h) + '</span><span class="km-tr">' + esc(trAd(h)) + '</span><span class="km-ok" aria-hidden="true">→</span><b lang="en">' + esc(en(h)) + '</b></button><div class="km-sira" data-kmsira></div></div>' : '') +
      '<div class="kk-alt-d"><button type="button" class="ka-orta" data-konce' + (n ? '' : ' disabled') + '>‹ Önceki</button><button type="button" class="ka-buyuk" data-ksonra>' + (n === b.sayfalar.length - 1 ? 'Sorular' : 'Sonraki') + ' ' + C.simge('oynat') + '</button></div></main>';
    o.kok.dataset.gorunum = 'kitap';
    var kart = o.kok.querySelector('[data-kmk]'), sira = o.kok.querySelector('[data-kmsira]'), sonraB = o.kok.querySelector('[data-ksonra]');
    var git = function (k) { if (iptal) return; iptal = true; if (W.KIDS_DINLE) W.KIDS_DINLE.durdur(); SES.sus(); ac(o, id, k); };
    var enSoyle = function () { return SES.soyle(en(h) + '!', 'en', { hiz: 0.85 }); };
    function oku() {
      return SES.soyle(duzMetin(sf.s), 'tr', { hiz: 0.95 }).then(function () {
        if (iptal || !h) return;
        kart.hidden = false; kart.classList.remove('km-gel'); void kart.offsetWidth; kart.classList.add('km-gel');
        return bekle(250).then(function () { return iptal ? 0 : SES.soyle(trAd(h) + ', İngilizce', 'tr'); }).then(function () { return iptal ? 0 : enSoyle(); }).then(function () { return iptal ? 0 : SES.soyle('Hadi sen de söyle!', 'tr'); }).then(function () { return iptal ? 0 : sendeSira(); });
      });
    }
    /* çocuğun sırası: mikrofon açıksa dinle; değilse "Söyledim!" */
    function sendeSira() {
      var DN = W.KIDS_DINLE;
      if (DN && DN.hazir()) return DN.tekrarla({ en: en(h), kok: sira, soyle: enSoyle }).then(function (r) { if (iptal) return; if (r === 'yok') return soyledimDugmesi(); tamam(r); });
      return soyledimDugmesi();
    }
    function soyledimDugmesi() {
      var DN = W.KIDS_DINLE, d = DN && DN.destek(), sorulabilir = DN && DN.izin() === 'sor' && d && (d.cihaz || d.kayit);
      sira.innerHTML = '<button type="button" class="ka-buyuk km-soyledim" data-kmsoy>' + C.simge('mikrofon') + ' Söyledim!</button>' + (sorulabilir ? '<button type="button" class="km-mikac" data-kmmik>Acadia beni duysun (büyükler açar)</button>' : '');
      sira.querySelector('[data-kmsoy]').addEventListener('click', function () { if (iptal) return; SES.fx('dogru'); sira.innerHTML = ''; SES.soyle(OVGU[n % OVGU.length], 'tr').then(function () { tamam('tamam'); }); });
      var mk = sira.querySelector('[data-kmmik]');
      if (mk) mk.addEventListener('click', function () { DN.izinSor().then(function (ok) { if (ok && !iptal) { sira.innerHTML = ''; sendeSira(); } }); });
    }
    function tamam(r) {
      if (iptal) return;
      sonraB.classList.add('km-nabiz');
      if (r === 'tamam' || r === 'denedi') { kart.classList.add('km-ogrendi'); setTimeout(function () { if (!iptal) git(n + 1); }, 1600); }
    }
    o.kok.querySelector('[data-kraf]').addEventListener('click', function () { iptal = true; if (W.KIDS_DINLE) W.KIDS_DINLE.durdur(); SES.sus(); SES.fx('dokun'); o.raf(); });
    o.kok.querySelector('[data-koku]').addEventListener('click', function () { if (W.KIDS_DINLE) W.KIDS_DINLE.durdur(); SES.sus(); SES.soyle(duzMetin(sf.s), 'tr', { hiz: 0.95 }); });
    sonraB.addEventListener('click', function () { SES.fx('dokun'); git(n + 1); });
    o.kok.querySelector('[data-konce]').addEventListener('click', function () { SES.fx('dokun'); git(n - 1); });
    var dk = o.kok.querySelector('[data-kmdinle]'); if (dk) dk.addEventListener('click', function () { SES.fx('dokun'); enSoyle(); });
    o.kok.querySelectorAll('[data-kr]').forEach(function (rb) {
      rb.addEventListener('click', function () { var rid = rb.getAttribute('data-kr'); rb.classList.remove('kk-zipla'); void rb.offsetWidth; rb.classList.add('kk-zipla'); SES.fx('dokun'); var hs = W.KIDS_KONUSAN && W.KIDS_KONUSAN.hayvanSesi({ id: rid }); if (hs && SES.hayvan) SES.hayvan(hs); });
    });
    setTimeout(function () { if (!iptal) oku(); }, 350);
  }

  /* sorular: "Hangisi car?" → resme dokun ya da söyle (mikrofon açıksa kendiliğinden dinler) */
  function sorular(b, i, dogruSay, ust) {
    var o = S, H = hedefler(b), sec = [H[0], H[2], H[4]].filter(Boolean), hedef = sec[i];
    if (!hedef || i >= 3) return bitir(b, dogruSay, ust);
    var diger = H.filter(function (x) { return x !== hedef; }).sort(function () { return Math.random() - 0.5; }).slice(0, 2), secenek = [hedef].concat(diger).sort(function () { return Math.random() - 0.5; });
    o.kok.innerHTML = ust + '<main class="ka-sahne kk-soru"><p class="kk-soru-no">Soru ' + (i + 1) + ' / 3</p><h2 class="kk-soru-s"><button type="button" class="ko-dinle" data-ksor aria-label="Soruyu dinle">' + C.simge('ses') + '</button>Hangisi <span lang="en">' + esc(en(hedef)) + '</span>?</h2>' +
      '<div class="ko-kartlar2">' + secenek.map(function (x) { return '<button type="button" class="ko-kart2" data-kcev="' + x + '" aria-label="' + esc(trAd(x)) + '">' + gorsel(x) + '</button>'; }).join('') + '</div><div class="km-sira" data-kmsira></div></main>';
    var bitti = false, ilk = true, sira = o.kok.querySelector('[data-kmsira]');
    var sor = function () { return SES.soyle('Hangisi', 'tr').then(function () { return SES.soyle(en(hedef) + '?', 'en'); }); };
    function cevap(x, bt) {
      if (bitti) return;
      if (x === hedef) { bitti = true; if (W.KIDS_DINLE) W.KIDS_DINLE.durdur(); SES.fx('dogru'); bt.classList.add('ko-dogru'); var y = ilk ? 1 : 0; SES.soyle(OVGU[i % OVGU.length], 'tr').then(function () { sorular(b, i + 1, dogruSay + y, ust); }); }
      else { ilk = false; SES.fx('yanlis'); bt.classList.remove('ko-salla'); void bt.offsetWidth; bt.classList.add('ko-salla'); sor(); }
    }
    o.kok.querySelectorAll('[data-kcev]').forEach(function (bt) { bt.addEventListener('click', function () { cevap(bt.getAttribute('data-kcev'), bt); }); });
    o.kok.querySelector('[data-ksor]').addEventListener('click', function () { SES.fx('dokun'); sor(); });
    o.kok.querySelector('[data-kraf]').addEventListener('click', function () { bitti = true; if (W.KIDS_DINLE) W.KIDS_DINLE.durdur(); SES.sus(); o.raf(); });
    o.kok.querySelector('[data-koku]').addEventListener('click', function () { sor(); });
    /* söyleyerek cevap: seçeneklerin İngilizcesi beklenir */
    function sesle() {
      var DN = W.KIDS_DINLE; if (!DN || !DN.hazir() || bitti) return;
      DN.gosterge(sira, 'dinliyor', 'Söyleyebilirsin de…');
      DN.dinle({ kelimeler: secenek.map(en), dil: 'en', sure: 6000 }).then(function (r) {
        if (bitti) return; DN.gosterge(sira, 'gizli');
        if (r.durum === 'tamam') { var x = secenek.filter(function (s) { return en(s) === r.kelime; })[0]; if (x) cevap(x, o.kok.querySelector('[data-kcev="' + x + '"]')); }
      });
    }
    sor().then(sesle);
  }
  function bitir(b, dogru, ust) {
    var o = S, il = o.il(); il.kitap = il.kitap || {}; il.kitap[b.id] = Date.now(); o.kaydet(il);
    var H = hedefler(b);
    o.kok.innerHTML = ust + '<main class="ka-sahne ka-bitis kk-bitti"><div class="ka-konfeti" aria-hidden="true">' + new Array(20).join('<i></i>') + '</div><div class="ka-ara-acd">' + C.acadia({ mood: 'kutlama' }) + '</div><h1>' + esc(b.ad) + '</h1><p>Masal bitti! İlk denemede <b>' + dogru + ' / 3</b> soruyu bildin.</p>' +
      '<h3 class="km-ogren-b">Bugün öğrendiğin kelimeler</h3><ul class="km-ogren">' + H.map(function (x) { return '<li><button type="button" data-kmo="' + x + '"><span>' + gorsel(x) + '</span><b lang="en">' + esc(en(x)) + '</b><small>' + esc(trAd(x)) + '</small></button></li>'; }).join('') + '</ul>' +
      '<div class="ka-izle-alt"><button type="button" class="ka-orta" data-kyine>Yeniden oku</button><button type="button" class="ka-buyuk" data-kraf2 data-odak>Kitaplık ' + C.simge('book') + '</button></div></main>';
    SES.fx('yildiz'); SES.soyle('Masal bitti! Bugün yeni kelimeler öğrendin.', 'tr');
    o.kok.querySelectorAll('[data-kmo]').forEach(function (bt) { bt.addEventListener('click', function () { SES.fx('dokun'); SES.soyle(en(bt.getAttribute('data-kmo')) + '!', 'en'); }); });
    o.kok.querySelector('[data-kraf]').addEventListener('click', function () { o.raf(); });
    o.kok.querySelector('[data-kraf2]').addEventListener('click', function () { SES.fx('dokun'); o.raf(); });
    o.kok.querySelector('[data-koku]').addEventListener('click', function () { SES.soyle('Masal bitti! Bugün yeni kelimeler öğrendin.', 'tr'); });
    o.kok.querySelector('[data-kyine]').addEventListener('click', function () { ac(o, b.id, 0); });
  }

  W.KIDS_MASAL = { LISTE: LISTE, ac: ac, cumleler: cumleler, duzMetin: duzMetin, hedefler: hedefler, en: en, trAd: trAd };
})(window);
