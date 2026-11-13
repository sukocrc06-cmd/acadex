/* ==========================================================================
   ACADEX KIDS · Evcil hayvanım, Benim günüm, Uyku vakti (kids/assets/kids-panel3.js), 13.11.2026
   Haritadaki "Köşeler" şeridinden açılan üç panel:
   - Evcil hayvanım: çocuk bir yavru seçer (kedi, köpek, tavşan). Yavru İngilizce ister
     ("I want an apple!", "Wash my ears!", "Let's play with the kite!"), çocuk üç resimden
     doğrusunu seçer. Açlık / temizlik / oyun / uyku zamanla azalır; her gün dönmeye değer.
   - Benim günüm: günlük rutinler ("I wake up.", "I brush my teeth."…). Önce izlenir,
     sonra kartlar doğru sıraya dizilir (yaşa göre 3-5 kart).
   - Uyku vakti: akşam için sakin mod. Koyu gökyüzü, ninni, yavaş okunan uyku hikâyesi.
     Oyun, yıldız, ödül yok; sonunda ekran kararır.
   W.KIDS_PANEL3 = { evcil, gunum, uyku, seritHtml, … }; o = { kok, il, kaydet, geri, bant, dur }
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, C = W.KIDS_CIZ, R = W.KIDS_RESIM, V = W.KIDS_VERI, SES = W.KIDS_SES, HV = W.KIDS_HAYVAN, KS = W.KIDS_KONUSAN;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function res(id) { return HV && HV.var(id) ? HV.ciz(id) : R.ciz(id); }
  function kar(l) { return l.slice().sort(function () { return Math.random() - 0.5; }); }
  function adli(id) { var x = V.ogeBul(id); return x ? (KS ? KS.adli(x) : x.en) : id; }
  function ing(id) { var x = V.ogeBul(id); return x ? x.en : id; }
  function ust(geriEt, bas, alt) { return '<header class="ka-konu-ust"><button type="button" class="ka-yuvarlak" data-p3geri aria-label="' + geriEt + '">' + C.simge('ev') + '</button><h1 class="kk-bas">' + bas + (alt ? ' <small lang="en">' + alt + '</small>' : '') + '</h1><span></span></header>'; }

  /* ------------------------------ Evcil hayvanım ------------------------------ */
  var TUR = [{ id: 'cat', ad: 'Kedi' }, { id: 'dog', ad: 'Köpek' }, { id: 'rabbit', ad: 'Tavşan' }];
  var YEMEK = ['apple', 'banana', 'carrot', 'cheese', 'milk', 'bread', 'cake', 'cookie', 'egg', 'strawberry'];
  var YIKA = ['ears', 'nose', 'face', 'tummy', 'feet'];
  var OYUNCAK = ['ball', 'kite', 'teddy', 'balloon', 'robot', 'car', 'drum', 'train'];
  var UYKU = ['bed', 'bath', 'table', 'sofa'];
  var IHTIYAC = [
    { id: 'ac', ad: 'Besle', en: 'Feed', simge: 'elma', soz: 'I\'m hungry!', liste: YEMEK, iste: function (x) { return 'I want ' + adli(x) + '!'; }, tamam: 'Yummy! Thank you!', fx: 'munch' },
    { id: 'temiz', ad: 'Yıka', en: 'Wash', simge: 'semsiye', soz: 'I\'m dirty!', liste: YIKA, iste: function (x) { return 'Wash my ' + ing(x) + '!'; }, tamam: 'I\'m clean now!', fx: 'splash' },
    { id: 'oyun', ad: 'Oyna', en: 'Play', simge: 'top', soz: 'I\'m bored!', liste: OYUNCAK, iste: function (x) { return 'Let\'s play with the ' + ing(x) + '!'; }, tamam: 'That was fun!', fx: null },
    { id: 'uyku', ad: 'Uyut', en: 'Sleep', simge: 'ay', soz: 'I\'m sleepy!', liste: UYKU, sabit: 'bed', iste: function () { return 'I want my bed!'; }, tamam: 'Good night!', fx: 'snore' }
  ];
  var SAATTE = 5;   /* her ihtiyaç saatte 5 puan azalır */
  function evcilOku(il) {
    var e = il.evcil; if (!e) return null;
    var saat = Math.max(0, (Date.now() - (e.t || Date.now())) / 3600000);
    IHTIYAC.forEach(function (h) { e[h.id] = Math.max(0, Math.round((e[h.id] == null ? 60 : e[h.id]) - saat * SAATTE)); });
    e.t = Date.now(); return e;
  }
  function enDusuk(e) { var s = IHTIYAC.slice().sort(function (a, b) { return e[a.id] - e[b.id]; })[0]; return e[s.id] < 70 ? s : null; }
  function evcilPhrases() {
    var l = ['Choose your pet!', 'I\'m happy!', 'I love you!', 'No, thank you!', 'Hello! I\'m your pet!'];
    IHTIYAC.forEach(function (h) { l.push(h.soz, h.tamam); (h.sabit ? [h.sabit] : h.liste).forEach(function (x) { l.push(h.iste(x)); }); });
    return l;
  }
  function evcil(o) {
    if (o.dur) o.dur(); SES.sus();
    var il = o.il(), e = evcilOku(il);
    if (!e) return evcilSec(o);
    o.kaydet(il);
    var kilit = false, istek = null;
    o.kok.dataset.gorunum = 'kitap';
    o.kok.innerHTML = '<div class="ka-dunya" aria-hidden="true">' + R.dunya('home') + '</div>' + ust('Haritaya dön', 'Evcil hayvanım', 'My pet') +
      '<main class="ka-sahne ke-ana"><div class="ke-sahne" data-ks><div class="ke-kalp" aria-label="Kalp sayısı">♥ <b data-kalp>' + (e.kalp || 0) + '</b></div><p class="ke-soz" data-soz lang="en"></p>' +
      '<button type="button" class="ke-yavru" data-yavru aria-label="Yavruna dokun">' + res(e.tur) + '</button><div class="ke-efekt" data-efekt aria-hidden="true"></div></div>' +
      '<div class="ke-secenek" data-sec hidden></div>' +
      '<div class="ke-dugmeler" data-dug>' + IHTIYAC.map(function (h) { return '<button type="button" class="ke-d" data-ih="' + h.id + '"><span>' + C.simge(h.simge) + '</span><b lang="en">' + h.en + '</b><small>' + h.ad + '</small><i class="ke-cubuk"><em data-c="' + h.id + '"></em></i></button>'; }).join('') + '</div>' +
      '<p class="ke-not">Yavrun ne istediğini İngilizce söyler. Doğru resme dokun. <button type="button" class="ke-degis" data-degis>Yavruyu değiştir</button></p></main>';
    var ks = o.kok.querySelector('[data-ks]'), soz = o.kok.querySelector('[data-soz]'), sec = o.kok.querySelector('[data-sec]'), dug = o.kok.querySelector('[data-dug]'), efekt = o.kok.querySelector('[data-efekt]');
    function cubuk() { IHTIYAC.forEach(function (h) { var c = o.kok.querySelector('[data-c="' + h.id + '"]'); c.style.width = e[h.id] + '%'; c.className = e[h.id] < 35 ? 'ke-az' : e[h.id] < 70 ? 'ke-orta' : ''; }); o.kok.querySelector('[data-kalp]').textContent = e.kalp || 0; }
    function de(metin) { soz.textContent = metin; ks.classList.add('kc-konusuyor'); return SES.soyle(metin, 'en', { perde: 1.5 }).then(function () { ks.classList.remove('kc-konusuyor'); }); }
    function durum() { var h = enDusuk(e); ks.className = 'ke-sahne' + (h ? ' ke-' + h.id : ' ke-mutlu'); return h; }
    function selam() { var h = durum(); return de(h ? h.soz : 'I\'m happy!'); }
    function kalpler() { efekt.innerHTML = new Array(7).join('<i>♥</i>'); setTimeout(function () { efekt.innerHTML = ''; }, 1600); }
    function bakim(h) {
      if (kilit) return; kilit = true; SES.sus(); SES.fx('dokun');
      var dogru = h.sabit || kar(h.liste)[0], digerleri = kar(h.liste.filter(function (x) { return x !== dogru; })).slice(0, 2), l = kar([dogru].concat(digerleri));
      istek = dogru; dug.hidden = true; sec.hidden = false;
      sec.innerHTML = l.map(function (x) { return '<button type="button" class="ko-kart2" data-ver="' + x + '" aria-label="' + esc(ing(x)) + '">' + R.ciz(x) + '</button>'; }).join('') + '<button type="button" class="ke-tekrar" data-tekrar aria-label="Yeniden dinle">' + C.simge('ses') + '</button>';
      de(h.iste(dogru)).then(function () { kilit = false; });
      sec.querySelector('[data-tekrar]').addEventListener('click', function () { SES.sus(); de(h.iste(dogru)); });
      sec.querySelectorAll('[data-ver]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (kilit) return;
          if (b.getAttribute('data-ver') !== istek) { SES.sus(); SES.fx('yanlis'); b.classList.remove('ko-salla'); void b.offsetWidth; b.classList.add('ko-salla'); de('No, thank you!').then(function () { return de(h.iste(dogru)); }); return; }
          kilit = true; SES.sus(); SES.fx('dogru'); b.classList.add('ko-dogru');
          e[h.id] = Math.min(100, e[h.id] + 40); e.kalp = (e.kalp || 0) + 1; e.t = Date.now(); var l2 = o.il(); l2.evcil = e; o.kaydet(l2); cubuk();
          ks.classList.add('ke-yap-' + h.id); efekt.innerHTML = h.id === 'temiz' ? new Array(9).join('<i class="ke-kopuk"></i>') : h.id === 'uyku' ? '<i class="ke-z">Z</i><i class="ke-z">z</i><i class="ke-z">z</i>' : h.id === 'ac' ? '<span class="ke-lokma">' + R.ciz(dogru) + '</span>' : '<span class="ke-oyuncak">' + R.ciz(dogru) + '</span>';
          (h.fx && SES.hayvan ? SES.hayvan(h.fx) : new Promise(function (r) { setTimeout(r, 900); })).then(function () { return de(h.tamam); }).then(function () {
            ks.classList.remove('ke-yap-' + h.id); efekt.innerHTML = ''; kalpler(); sec.hidden = true; dug.hidden = false; kilit = false; durum();
          });
        });
      });
    }
    o.kok.querySelectorAll('[data-ih]').forEach(function (b) { b.addEventListener('click', function () { bakim(IHTIYAC.filter(function (h) { return h.id === b.getAttribute('data-ih'); })[0]); }); });
    o.kok.querySelector('[data-yavru]').addEventListener('click', function () { if (kilit) return; SES.sus(); kalpler(); (SES.hayvan ? SES.hayvan(e.tur === 'cat' ? 'purr' : e.tur) : Promise.resolve()).then(function () { de('I love you!'); }); });
    o.kok.querySelector('[data-degis]').addEventListener('click', function () { SES.fx('dokun'); evcilSec(o); });
    o.kok.querySelector('[data-p3geri]').addEventListener('click', function () { SES.sus(); SES.fx('dokun'); o.geri(); });
    cubuk(); setTimeout(selam, 400);
  }
  function evcilSec(o) {
    SES.sus(); o.kok.dataset.gorunum = 'kitap';
    o.kok.innerHTML = '<div class="ka-dunya" aria-hidden="true">' + R.dunya('animals') + '</div>' + ust('Haritaya dön', 'Evcil hayvanım', 'My pet') +
      '<main class="ka-sahne ke-sec"><h2 lang="en">Choose your pet!</h2><p>Bir yavru seç. Ona her gün sen bakacaksın.</p><div class="ke-turler">' +
      TUR.map(function (t, i) { return '<button type="button" class="ke-tur" data-tur="' + t.id + '" style="--i:' + i + '">' + res(t.id) + '<b lang="en">' + ing(t.id) + '</b><small>' + t.ad + '</small></button>'; }).join('') + '</div></main>';
    o.kok.querySelectorAll('[data-tur]').forEach(function (b) {
      b.addEventListener('click', function () {
        var il = o.il(), eski = il.evcil || {}; il.evcil = { tur: b.getAttribute('data-tur'), ac: 50, temiz: 60, oyun: 50, uyku: 80, kalp: eski.kalp || 0, t: Date.now() }; o.kaydet(il);
        SES.fx('yildiz'); b.classList.add('ke-secildi'); (SES.hayvan ? SES.hayvan(il.evcil.tur) : Promise.resolve()).then(function () { evcil(o); });
      });
    });
    o.kok.querySelector('[data-p3geri]').addEventListener('click', function () { SES.sus(); SES.fx('dokun'); o.geri(); });
    SES.soyle('Choose your pet!', 'en');
  }

  /* ------------------------------ Benim günüm ------------------------------ */
  var RUTIN = [
    { id: 'wake', s: 'I wake up.', r: ['sunrise', 'bed'], z: 'sabah' }, { id: 'wash', s: 'I wash my face.', r: ['face', 'sink'], z: 'sabah' },
    { id: 'teeth', s: 'I brush my teeth.', r: ['teeth'], z: 'sabah' }, { id: 'dress', s: 'I get dressed.', r: ['tshirt', 'shoes'], z: 'sabah' },
    { id: 'breakfast', s: 'I eat breakfast.', r: ['bread', 'egg', 'milk'], z: 'sabah' }, { id: 'school', s: 'I go to school.', r: ['bag', 'bus'], z: 'gunduz' },
    { id: 'play', s: 'I play with my friends.', r: ['ball', 'friend'], z: 'gunduz' }, { id: 'dinner', s: 'I eat dinner.', r: ['soup', 'table'], z: 'aksam' },
    { id: 'bath', s: 'I take a bath.', r: ['bath'], z: 'aksam' }, { id: 'story', s: 'I read a book.', r: ['book'], z: 'aksam' },
    { id: 'sleep', s: 'I go to bed. Good night!', r: ['bed', 'moon'], z: 'gece' }
  ];
  var SIRA_SAY = { Minikler: 3, 'Kâşifler': 4, 'Yıldızlar': 5 };
  var GUNUM_SOZ = ['This is my day!', 'What comes first?', 'What comes next?', 'Now you put them in order!', 'Great! That\'s my day!'];
  function rutinKart(x, cls) { return '<span class="kg-res ' + (cls || '') + '">' + x.r.map(function (r) { return res(r); }).join('') + '</span>'; }
  function gunum(o) {
    if (o.dur) o.dur(); SES.sus();
    var iptal = false, i = 0;
    o.kok.dataset.gorunum = 'kitap';
    o.kok.innerHTML = '<div class="ka-dunya" aria-hidden="true">' + R.dunya('days') + '</div>' + ust('Haritaya dön', 'Benim günüm', 'My day') +
      '<main class="ka-sahne kg-ana"><div class="kg-gok" data-gok><span class="kg-gunes" aria-hidden="true">' + R.ciz('sun') + '</span><span class="kg-ay" aria-hidden="true">' + R.ciz('moon') + '</span></div>' +
      '<div class="kg-kart" data-kart></div><p class="kg-cumle" data-cumle lang="en"></p>' +
      '<ol class="kg-serit" data-serit>' + RUTIN.map(function (x, j) { return '<li><button type="button" data-rt="' + j + '" aria-label="' + esc(x.s) + '">' + res(x.r[0]) + '</button></li>'; }).join('') + '</ol>' +
      '<div class="ka-izle-alt"><button type="button" class="ka-orta" data-gbas>Baştan izle</button><button type="button" class="ka-buyuk" data-gsira>Sırala ' + C.simge('oynat') + '</button></div></main>';
    var kart = o.kok.querySelector('[data-kart]'), cumle = o.kok.querySelector('[data-cumle]'), gok = o.kok.querySelector('[data-gok]'), serit = o.kok.querySelector('[data-serit]'), kosu = 0;
    function goster(j) {
      var x = RUTIN[j]; i = j;
      gok.className = 'kg-gok kg-' + x.z; gok.style.setProperty('--p', (j / (RUTIN.length - 1)).toFixed(3));
      kart.innerHTML = rutinKart(x, 'kg-buyuk'); cumle.textContent = x.s;
      [].forEach.call(serit.children, function (li, m) { li.className = m === j ? 'kg-bu' : m < j ? 'kg-gecti' : ''; });
      return SES.soyle(x.s, 'en', { hiz: 0.9 });
    }
    async function izle(bas) {
      var benim = ++kosu;
      if (!bas) { await SES.soyle('This is my day!', 'en'); if (iptal || benim !== kosu) return; }
      for (var j = bas || 0; j < RUTIN.length; j++) { await goster(j); if (iptal || benim !== kosu) return; await new Promise(function (r) { setTimeout(r, 900); }); if (iptal || benim !== kosu) return; }
    }
    serit.addEventListener('click', function (e) { var b = e.target.closest('[data-rt]'); if (!b) return; SES.sus(); SES.fx('dokun'); kosu++; goster(+b.getAttribute('data-rt')); });
    o.kok.querySelector('[data-gbas]').addEventListener('click', function () { SES.sus(); SES.fx('dokun'); izle(0); });
    o.kok.querySelector('[data-gsira]').addEventListener('click', function () { iptal = true; SES.sus(); SES.fx('dokun'); sirala(o); });
    o.kok.querySelector('[data-p3geri]').addEventListener('click', function () { iptal = true; SES.sus(); SES.fx('dokun'); o.geri(); });
    izle(0);
  }
  function sirala(o) {
    var n = SIRA_SAY[(o.bant() || {}).ad] || 4, bas = Math.floor(Math.random() * (RUTIN.length - n + 1)), dogru = RUTIN.slice(bas, bas + n), kartlar = kar(dogru), sirada = 0, kilit = false;
    if (kartlar.every(function (x, j) { return x === dogru[j]; })) kartlar.reverse();
    o.kok.innerHTML = '<div class="ka-dunya" aria-hidden="true">' + R.dunya('days') + '</div>' + ust('Benim günüme dön', 'Sırala', 'Put in order') +
      '<main class="ka-sahne kg-sirala"><p class="kg-soru" lang="en"><button type="button" class="ko-dinle" data-gdinle aria-label="Dinle">' + C.simge('ses') + '</button><span data-gsoru>What comes first?</span></p>' +
      '<ol class="kg-yuvalar">' + dogru.map(function (x, j) { return '<li data-yuva="' + j + '"><b>' + (j + 1) + '</b></li>'; }).join('') + '</ol>' +
      '<div class="kg-kartlar">' + kartlar.map(function (x) { return '<button type="button" class="kg-k" data-gk="' + x.id + '" aria-label="' + esc(x.s) + '">' + rutinKart(x) + '</button>'; }).join('') + '</div>' +
      '<div class="ka-izle-alt" data-galt hidden><button type="button" class="ka-orta" data-gyine>Bir daha</button><button type="button" class="ka-buyuk" data-gbitti>Benim günüm ' + C.simge('oynat') + '</button></div></main>';
    var soru = o.kok.querySelector('[data-gsoru]');
    function sor() { var m = sirada === 0 ? 'What comes first?' : 'What comes next?'; soru.textContent = m; return SES.soyle(m, 'en'); }
    o.kok.querySelector('[data-gdinle]').addEventListener('click', function () { SES.fx('dokun'); sor(); });
    o.kok.querySelectorAll('[data-gk]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (kilit || b.disabled) return;
        var x = dogru[sirada];
        if (b.getAttribute('data-gk') !== x.id) { SES.fx('yanlis'); b.classList.remove('ko-salla'); void b.offsetWidth; b.classList.add('ko-salla'); return; }
        kilit = true; SES.sus(); SES.fx('seri', sirada + 1); b.disabled = true; b.classList.add('kg-kondu');
        var y = o.kok.querySelector('[data-yuva="' + sirada + '"]'); y.innerHTML = '<b>' + (sirada + 1) + '</b>' + rutinKart(x) + '<small lang="en">' + esc(x.s) + '</small>'; y.classList.add('kg-dolu');
        sirada++;
        SES.soyle(x.s, 'en').then(function () {
          kilit = false;
          if (sirada < dogru.length) return sor();
          var il = o.il(); il.gunum = (il.gunum || 0) + 1; o.kaydet(il);
          SES.fx('yildiz'); soru.textContent = 'Great! That\'s my day!'; o.kok.querySelector('[data-galt]').hidden = false; o.kok.querySelector('.kg-kartlar').hidden = true; SES.soyle('Great! That\'s my day!', 'en');
        });
      });
    });
    o.kok.querySelector('[data-gyine]').addEventListener('click', function () { SES.sus(); SES.fx('dokun'); sirala(o); });
    o.kok.querySelector('[data-gbitti]').addEventListener('click', function () { SES.sus(); SES.fx('dokun'); gunum(o); });
    o.kok.querySelector('[data-p3geri]').addEventListener('click', function () { SES.sus(); SES.fx('dokun'); gunum(o); });
    SES.soyle('Now you put them in order!', 'en').then(sor);
  }

  /* ------------------------------ Uyku vakti ------------------------------ */
  var GECE = [
    ['The sun goes down. The sky is dark.', ['nightsky']], ['The moon says hello to the stars.', ['moon', 'star']], ['The little bird is in her nest.', ['nest', 'bird']],
    ['The little bear is in his bed.', ['bear', 'bed']], ['The fish sleep in the sea.', ['fish']], ['The cat is warm and sleepy.', ['cat']],
    ['Now close your eyes, like the moon.', ['moon']], ['Good night. Sweet dreams.', ['star']]
  ];
  function uyku(o) {
    if (o.dur) o.dur(); SES.sus();
    var iptal = false, n = 0, durdu = false;
    o.kok.dataset.gorunum = 'uyku';
    o.kok.innerHTML = '<div class="ku-gece"><div class="ku-yildizlar" aria-hidden="true">' + new Array(26).join('<i></i>') + '</div>' +
      '<header class="ku-ust"><button type="button" class="ka-yuvarlak" data-p3geri aria-label="Haritaya dön">' + C.simge('ev') + '</button><h1>Uyku vakti <small lang="en">Bedtime</small></h1><button type="button" class="ka-yuvarlak" data-udur aria-pressed="false" aria-label="Duraklat">❚❚</button></header>' +
      '<main class="ku-ana"><div class="ku-acd">' + C.acadia({ mood: 'uyku' }) + '</div><div class="ku-resim" data-ures></div><p class="ku-cumle" data-ucumle lang="en"></p>' +
      '<ol class="ku-nokta" data-unokta>' + GECE.map(function () { return '<li></li>'; }).join('') + '</ol><p class="ku-not">Işığı kıs, telefonu yanına koy ve dinle. Bu modda oyun ve ödül yok.</p></main></div>';
    var resEl = o.kok.querySelector('[data-ures]'), cumle = o.kok.querySelector('[data-ucumle]'), nokta = o.kok.querySelector('[data-unokta]'), gece = o.kok.querySelector('.ku-gece');
    function bekle(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    async function oku() {
      if (SES.ninni) SES.ninni(true);
      await bekle(1200);
      for (; n < GECE.length; n++) {
        while (durdu && !iptal) await bekle(300);
        if (iptal) return;
        var sf = GECE[n]; resEl.innerHTML = sf[1].map(function (r) { return '<span>' + R.ciz(r) + '</span>'; }).join(''); cumle.textContent = sf[0];
        resEl.classList.remove('ku-gir'); cumle.classList.remove('ku-gir'); void resEl.offsetWidth; resEl.classList.add('ku-gir'); cumle.classList.add('ku-gir');
        [].forEach.call(nokta.children, function (li, m) { li.className = m <= n ? 'ku-gecti' : ''; });
        await bekle(900); if (iptal) return;
        await SES.soyle(sf[0], 'en', { hiz: 0.75 }); if (iptal) return;
        await bekle(2600);
      }
      if (iptal) return;
      gece.classList.add('ku-bitti'); cumle.textContent = 'İyi geceler.'; cumle.removeAttribute('lang'); resEl.innerHTML = '';
      await bekle(20000); if (!iptal && SES.ninni) SES.ninni(false);
    }
    function cik() { iptal = true; SES.sus(); if (SES.ninni) SES.ninni(false); }
    o.kok.querySelector('[data-udur]').addEventListener('click', function (e) { durdu = !durdu; e.currentTarget.setAttribute('aria-pressed', durdu); e.currentTarget.textContent = durdu ? '▶' : '❚❚'; if (durdu) { SES.sus(); if (SES.ninni) SES.ninni(false); } else if (SES.ninni) SES.ninni(true); });
    o.kok.querySelector('[data-p3geri]').addEventListener('click', function () { cik(); o.geri(); });
    oku();
    return { dur: cik };
  }

  /* haritadaki "Köşeler" şeridi */
  function seritHtml(il) {
    var e = il && il.evcil, h = e ? enDusuk(evcilOku(il)) : null;
    return '<section class="ka-koseler" aria-label="Köşeler"><button type="button" class="ka-kose ka-k-evcil" data-kose="evcil"><span class="ka-kose-r">' + res(e ? e.tur : 'cat') + '</span><b>Evcil hayvanım</b><small>' + (e ? (h ? 'Yavrun seni bekliyor!' : 'Yavrun mutlu ♥ ' + (e.kalp || 0)) : 'Bir yavru seç, ona sen bak') + '</small>' + (h ? '<i class="ka-kose-uyari" aria-hidden="true">!</i>' : '') + '</button>' +
      '<button type="button" class="ka-kose ka-k-gunum" data-kose="gunum"><span class="ka-kose-r">' + R.ciz('sunrise') + '</span><b>Benim günüm</b><small>Sabahtan akşama neler yaparım?</small></button>' +
      '<button type="button" class="ka-kose ka-k-uyku" data-kose="uyku"><span class="ka-kose-r">' + R.ciz('moon') + '</span><b>Uyku vakti</b><small>Sakin bir hikâye ve ninni</small></button></section>';
  }
  function ac(ad, o) { return ad === 'evcil' ? evcil(o) : ad === 'gunum' ? gunum(o) : uyku(o); }
  /* ses kataloğu için bütün cümleler */
  function cumleler() { return evcilPhrases().concat(RUTIN.map(function (x) { return x.s; }), GUNUM_SOZ, GECE.map(function (x) { return x[0]; })); }
  W.KIDS_PANEL3 = { evcil: evcil, gunum: gunum, uyku: uyku, ac: ac, seritHtml: seritHtml, cumleler: cumleler, RUTIN: RUTIN, GECE: GECE, IHTIYAC: IHTIYAC, TUR: TUR, evcilOku: evcilOku, enDusuk: enDusuk, SAATTE: SAATTE };
})(window);
