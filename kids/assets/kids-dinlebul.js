/* ==========================================================================
   ACADEX KIDS · DİNLE VE BUL (kids/assets/kids-dinlebul.js + kids-dinlebul.css), 27.11.2026
   Anaokulu ve kreş (3-6 yaş, okuma yok) için yazısız dünya: Acadia İngilizce kısa bir kalıp söyler,
   çocuk üç büyük resimden doğrusuna dokunur. Kural anlatılmaz; kalıplar (I am happy, It is red,
   two cats, a big ball, in / on / under, I can jump, I like apples, It is sunny) dinleyerek öğrenilir.
   Ekranda yazı yok: düğmeler simge, sorular ses; ekran okuyucu için aria-label var.
   ŞİMDİLİK YALNIZ TEST EKİBİNDE (W.KIDS_EKIP, kids-test.js); haritada kapı kids-app.js'te.
   Kart biçimi: 'cat' resim (KIDS_RESIM) · 'renk:#E5484D' renkli top · 'say:3:cat' üç kedi ·
                'boy:b:ball' büyük, 'boy:k:ball' küçük
   Kayıt: il.dinleBul[konu] = en iyi yıldız · il.dinleBulLog (son 60)
   W.KIDS_DINLEBUL = { ac(oz), KONU, kartCoz, yildiz, konuAcik, cumleler() }
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, C = null, SES = null, R = null, M = '#23304D';
  var SAKIN = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  function t(id, kapak, renk, tr, s) { return { id: id, kapak: kapak, renk: renk, tr: tr, s: s }; }
  /* s: [İngilizce cümle, doğru kart, yanlış kart, yanlış kart] */
  var KONU = [
    t('d-duygu', 'happy', '#FFD23F', 'Duygular', [['I am happy.', 'happy', 'sad', 'angry'], ['I am sad.', 'sad', 'happy', 'tired'], ['I am angry.', 'angry', 'happy', 'scared'], ['I am tired.', 'tired', 'happy', 'hungry'],
      ['I am hungry.', 'hungry', 'sad', 'scared'], ['I am scared.', 'scared', 'happy', 'tired'], ['She is happy.', 'happy', 'angry', 'sad']]),
    t('d-hayvan', 'cat', '#FF9E57', 'Hayvanlar: It is a...', [['It is a cat.', 'cat', 'dog', 'cow'], ['It is a dog.', 'dog', 'cat', 'duck'], ['It is a cow.', 'cow', 'lion', 'fish'], ['It is a lion.', 'lion', 'cow', 'bird'],
      ['It is a duck.', 'duck', 'frog', 'cat'], ['It is a fish.', 'fish', 'bird', 'rabbit'], ['It is a rabbit.', 'rabbit', 'frog', 'dog']]),
    t('d-renk', 'renk:#E5484D', '#E5484D', 'Renkler: It is red', [['It is red.', 'renk:#E5484D', 'renk:#3B82F6', 'renk:#22C55E'], ['It is blue.', 'renk:#3B82F6', 'renk:#E5484D', 'renk:#FACC15'], ['It is green.', 'renk:#22C55E', 'renk:#FACC15', 'renk:#3B82F6'],
      ['It is yellow.', 'renk:#FACC15', 'renk:#22C55E', 'renk:#E5484D'], ['It is pink.', 'renk:#F472B6', 'renk:#8B5CF6', 'renk:#FB923C'], ['It is orange.', 'renk:#FB923C', 'renk:#F472B6', 'renk:#3B82F6'], ['It is purple.', 'renk:#8B5CF6', 'renk:#22C55E', 'renk:#FB923C']]),
    t('d-sayi', 'say:2:cat', '#4CC38A', 'Sayılar: two cats', [['One cat.', 'say:1:cat', 'say:2:cat', 'say:3:cat'], ['Two cats.', 'say:2:cat', 'say:1:cat', 'say:3:cat'], ['Three cats.', 'say:3:cat', 'say:2:cat', 'say:1:cat'],
      ['Two dogs.', 'say:2:dog', 'say:3:dog', 'say:1:dog'], ['One bird.', 'say:1:bird', 'say:2:bird', 'say:3:bird'], ['Three apples.', 'say:3:apple', 'say:1:apple', 'say:2:apple'], ['Two balls.', 'say:2:ball', 'say:3:ball', 'say:1:ball']]),
    t('d-boy', 'boy:b:ball', '#7E8CFF', 'Büyük, küçük: big / small', [['A big ball.', 'boy:b:ball', 'boy:k:ball', 'boy:k:car'], ['A small ball.', 'boy:k:ball', 'boy:b:ball', 'boy:b:kite'], ['A big car.', 'boy:b:car', 'boy:k:car', 'boy:k:ball'],
      ['A small car.', 'boy:k:car', 'boy:b:car', 'boy:b:teddy'], ['A big teddy.', 'boy:b:teddy', 'boy:k:teddy', 'boy:k:car'], ['A small teddy.', 'boy:k:teddy', 'boy:b:teddy', 'boy:b:ball'], ['A big elephant.', 'boy:b:elephant', 'boy:k:mouse', 'boy:k:elephant']]),
    t('d-yer', 'in', '#8BC34A', 'Nerede: in / on / under', [['The ball is in the box.', 'in', 'on', 'under'], ['The ball is on the box.', 'on', 'in', 'under'], ['The ball is under the box.', 'under', 'on', 'in'],
      ['The ball is next to the box.', 'next', 'in', 'on'], ['The ball is behind the box.', 'behind', 'front', 'on'], ['The ball is in front of the box.', 'front', 'behind', 'under'], ['Where is the ball? Under the box.', 'under', 'in', 'next']]),
    t('d-eylem', 'jump', '#FF6B5B', 'Yapabilirim: I can jump', [['I can jump.', 'jump', 'swim', 'sleep'], ['I can swim.', 'swim', 'run', 'sing'], ['I can run.', 'run', 'climb', 'eat'], ['I can sing.', 'sing', 'dance', 'jump'],
      ['I can dance.', 'dance', 'sleep', 'swim'], ['I can climb.', 'climb', 'run', 'read'], ['I can draw.', 'draw', 'read', 'dance']]),
    t('d-aile', 'family', '#FF6B9A', 'Ailem: This is my mum', [['This is my mum.', 'mum', 'dad', 'baby'], ['This is my dad.', 'dad', 'mum', 'grandpa'], ['This is my baby brother.', 'baby', 'sister', 'grandma'],
      ['This is my sister.', 'sister', 'brother', 'mum'], ['This is my brother.', 'brother', 'sister', 'dad'], ['This is my grandma.', 'grandma', 'grandpa', 'baby'], ['This is my grandpa.', 'grandpa', 'grandma', 'dad']]),
    t('d-yemek', 'apple', '#2FB7B0', 'Severim: I like apples', [['I like apples.', 'apple', 'banana', 'milk'], ['I like bananas.', 'banana', 'apple', 'cake'], ['I like milk.', 'milk', 'bread', 'egg'], ['I like cake.', 'cake', 'carrot', 'apple'],
      ['I like bread.', 'bread', 'milk', 'banana'], ['I like carrots.', 'carrot', 'cake', 'egg'], ['I like eggs.', 'egg', 'bread', 'carrot']]),
    t('d-hava', 'sunny', '#4AA8FF', 'Hava: It is sunny', [['It is sunny.', 'sunny', 'rainy', 'snowy'], ['It is rainy.', 'rainy', 'sunny', 'windy'], ['It is snowy.', 'snowy', 'cloudy', 'sunny'], ['It is windy.', 'windy', 'snowy', 'rainy'],
      ['It is cloudy.', 'cloudy', 'sunny', 'snowy'], ['Look! It is raining.', 'rainy', 'sunny', 'cloudy'], ['It is cold. It is snowy.', 'snowy', 'sunny', 'windy']])
  ];

  /* ---------------- saf yardımcılar (tests/kids-dinlebul.js) ---------------- */
  function kartCoz(k) {
    var p = String(k).split(':');
    if (p[0] === 'renk') return { tur: 'renk', renk: p[1] };
    if (p[0] === 'say') return { tur: 'say', n: +p[1], id: p[2] };
    if (p[0] === 'boy') return { tur: 'boy', buyuk: p[1] === 'b', id: p[2] };
    return { tur: 'resim', id: k };
  }
  function yildiz(hata) { return hata <= 1 ? 3 : hata <= 3 ? 2 : 1; }
  function konuAcik(i, k) { return !!W.KIDS_EKIP || k === 0 || ((i.dinleBul || {})[KONU[k - 1].id] || 0) > 0 || ((i.dinleBul || {})[KONU[k].id] || 0) > 0; }
  function karistir(a) { var b = a.slice(); for (var i = b.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = b[i]; b[i] = b[j]; b[j] = x; } return b; }

  function resim(id) { return R && R.var && R.var(id) && R.ciz ? R.ciz(id) : ''; }
  function kartHtml(k) {
    var c = kartCoz(k);
    if (c.tur === 'renk') return '<svg class="kdb-top" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="52" r="38" fill="' + c.renk + '" stroke="' + M + '" stroke-width="5"/><path d="M30 38 q10 -14 26 -14" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".55"/></svg>';
    if (c.tur === 'say') return '<span class="kdb-say kdb-say' + c.n + '">' + new Array(c.n + 1).join('<span class="kdb-say-i">' + resim(c.id) + '</span>') + '</span>';
    if (c.tur === 'boy') return '<span class="kdb-boy ' + (c.buyuk ? 'kdb-b' : 'kdb-k') + '">' + resim(c.id) + '</span>';
    return '<span class="kdb-res">' + resim(c.id) + '</span>';
  }
  function acd(m, poz) { return C && C.acadia ? C.acadia({ mood: m || 'mutlu', pose: poz }) : ''; }
  var oz = null, durum = null;
  function il() { return oz.il(); }
  function kaydet(i) { oz.kaydet(i); }
  function dur() { durum = null; if (SES && SES.sus) SES.sus(); }
  function bekle(ms) { return new Promise(function (r) { setTimeout(r, SAKIN ? Math.min(ms, 200) : ms); }); }
  function soyle(m, dil) { return SES ? Promise.resolve(SES.soyle(m, dil)).catch(function () { }) : Promise.resolve(); }
  function simge(ad, yedek) { return C && C.simge ? C.simge(ad) : yedek; }

  /* ---------------- bahçe (konu seçimi) ---------------- */
  function bahce() {
    dur(); var i = il(), d = i.dinleBul || {};
    oz.kok.innerHTML = '<div class="kdb">' +
      '<header class="kdb-ust"><button type="button" class="kdb-yuv" data-kdbgeri aria-label="Haritaya dön">' + simge('ev', '←') + '</button><h1 class="kdb-gizli">Dinle ve Bul</h1>' +
      '<span class="kdb-ust-acd" aria-hidden="true">' + acd('mutlu', 'el') + '</span><button type="button" class="kdb-yuv kdb-ses-b" data-kdbsoyle aria-label="Ne yapacağımı söyle">' + simge('ses', '♪') + '</button></header>' +
      '<main class="kdb-bahce" aria-label="Konular"><span class="kdb-gunes" aria-hidden="true"></span><span class="kdb-cimen" aria-hidden="true"></span><ol class="kdb-balonlar">' + KONU.map(function (x, k) {
        var ac = konuAcik(i, k), y = d[x.id] || 0;
        return '<li style="--r:' + x.renk + ';--i:' + k + '"><button type="button" class="kdb-balon' + (ac ? '' : ' kdb-kilit') + '" data-kdbk="' + k + '"' + (ac ? '' : ' aria-disabled="true"') + ' aria-label="' + esc(x.tr + (ac ? (y ? ', ' + y + ' yıldız' : '') : ', kilitli')) + '">' +
          '<span class="kdb-b-ic" aria-hidden="true">' + kartHtml(x.kapak) + '</span>' + (ac ? '<span class="kdb-b-y" aria-hidden="true">' + [1, 2, 3].map(function (q) { return '<i' + (q <= y ? ' class="on"' : '') + '>★</i>'; }).join('') + '</span>' : '<span class="kdb-b-y" aria-hidden="true">🔒</span>') + '<span class="kdb-ip" aria-hidden="true"></span></button></li>';
      }).join('') + '</ol></main></div>';
    oz.kok.dataset.gorunum = 'dinlebul';
    oz.kok.querySelector('[data-kdbgeri]').addEventListener('click', function () { if (SES) SES.fx('dokun'); dur(); oz.geri(); });
    var yon = function () { soyle('Dinle ve Bul! Bir balona dokun.', 'tr'); };
    oz.kok.querySelector('[data-kdbsoyle]').addEventListener('click', function () { if (SES) SES.sus(); yon(); });
    oz.kok.querySelectorAll('[data-kdbk]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = +b.getAttribute('data-kdbk');
        if (!konuAcik(il(), k)) { if (SES) { SES.fx('yanlis'); SES.soyle('Önce bir önceki balonu bitir.', 'tr'); } b.classList.remove('kdb-salla'); void b.offsetWidth; b.classList.add('kdb-salla'); return; }
        if (SES) SES.fx('dokun'); b.classList.add('kdb-pat'); setTimeout(function () { oyun(KONU[k]); }, SAKIN ? 0 : 380);
      });
    });
    yon();
  }

  /* ---------------- oyun: dinle, resme dokun ---------------- */
  function oyun(x) {
    dur(); durum = {}; var ben = durum, L = karistir(x.s), n = 0, hataT = 0;
    oz.kok.innerHTML = '<div class="kdb kdb-oyun" style="--r:' + x.renk + '">' +
      '<header class="kdb-ust"><button type="button" class="kdb-yuv" data-kdbgeri aria-label="Balonlara dön">' + simge('ev', '←') + '</button><h1 class="kdb-gizli">' + esc(x.tr) + '</h1>' +
      '<ol class="kdb-nokta" aria-label="İlerleme">' + new Array(L.length + 1).join('<li></li>') + '</ol><span></span></header>' +
      '<main class="kdb-alan"><div class="kdb-soru"><span class="kdb-acd" aria-hidden="true">' + acd('mutlu', 'isaret') + '</span><button type="button" class="kdb-dinle" data-kdbdinle aria-label="Bir daha dinle">' + simge('ses', '♪') + '</button></div>' +
      '<div class="kdb-kartlar" data-kdbkart></div></main></div>';
    oz.kok.dataset.gorunum = 'dinlebul';
    oz.kok.querySelector('[data-kdbgeri]').addEventListener('click', function () { if (SES) SES.fx('dokun'); bahce(); });
    var nk = [].slice.call(oz.kok.querySelectorAll('.kdb-nokta li')), kutu = oz.kok.querySelector('[data-kdbkart]'), acdEl = oz.kok.querySelector('.kdb-acd'), dinleB = oz.kok.querySelector('[data-kdbdinle]');
    function konus(m) { dinleB.classList.add('kdb-konusuyor'); return soyle(m, 'en').then(function () { dinleB.classList.remove('kdb-konusuyor'); }); }
    dinleB.addEventListener('click', function () { if (SES) SES.sus(); konus(L[n][0]); });
    function tur() {
      if (ben !== durum) return; var q = L[n], secler = karistir(q.slice(1)), cozuldu = false, yanlis = 0;
      nk.forEach(function (li, j) { li.className = j < n ? 'tamam' : j === n ? 'simdi' : ''; });
      kutu.innerHTML = secler.map(function (k, j) { return '<button type="button" class="kdb-kart" data-kdbs="' + esc(k) + '" style="--j:' + j + '" aria-label="Resim ' + (j + 1) + '">' + kartHtml(k) + '</button>'; }).join('');
      acdEl.innerHTML = acd('mutlu', 'isaret');
      kutu.onclick = function (e) {
        var b = e.target.closest('[data-kdbs]'); if (!b || b.disabled || cozuldu || ben !== durum) return;
        if (b.getAttribute('data-kdbs') === q[1]) {
          cozuldu = true; if (SES) SES.fx('dogru'); b.classList.add('kdb-dogru'); acdEl.innerHTML = acd('kutlama');
          kutu.querySelectorAll('.kdb-kart').forEach(function (z) { if (z !== b) z.classList.add('kdb-sonuk'); });
          konus(q[0]).then(function () { return bekle(500); }).then(function () { if (ben !== durum) return; n++; if (n >= L.length) bitis(x, yildiz(hataT), hataT); else tur(); });
        } else {
          hataT++; yanlis++; if (SES) SES.fx('yanlis'); b.classList.remove('kdb-salla'); void b.offsetWidth; b.classList.add('kdb-salla'); acdEl.innerHTML = acd('dusun');
          if (yanlis >= 2) { var d = kutu.querySelector('[data-kdbs="' + q[1] + '"]'); if (d) d.classList.add('kdb-ipucu'); }
          setTimeout(function () { if (ben === durum && !cozuldu) konus(q[0]); }, 450);
        }
      };
      bekle(n ? 200 : 0).then(function () { if (ben === durum) konus(q[0]); });
    }
    soyle('Dinle ve doğru resme dokun!', 'tr').then(function () { if (ben === durum) tur(); });
  }
  function bitis(x, y, hata) {
    var i = il(); i.dinleBul = i.dinleBul || {}; if (!(i.dinleBul[x.id] >= y)) i.dinleBul[x.id] = y;
    i.dinleBulLog = (i.dinleBulLog || []).concat([{ t: Date.now(), id: x.id, y: y, h: hata }]).slice(-60); kaydet(i);
    var alan = oz.kok.querySelector('.kdb-alan');
    alan.innerHTML = '<div class="kdb-bitis"><div class="ka-konfeti" aria-hidden="true">' + new Array(24).join('<i></i>') + '</div><span class="kdb-bitis-acd" aria-hidden="true">' + acd('kutlama') + '</span>' +
      '<p class="kdb-yildiz" aria-label="' + y + ' yıldız">' + [1, 2, 3].map(function (q) { return '<i' + (q <= y ? ' class="on"' : '') + ' style="--q:' + q + '">★</i>'; }).join('') + '</p>' +
      '<div class="kdb-bitis-d"><button type="button" class="kdb-yuv kdb-yuv-b" data-kdbtekrar aria-label="Bir daha oyna">↻</button><button type="button" class="kdb-yuv kdb-yuv-b kdb-yesil" data-kdbbitti aria-label="Balonlara dön">' + simge('ev', '⌂') + '</button></div></div>';
    oz.kok.querySelectorAll('.kdb-nokta li').forEach(function (li) { li.className = 'tamam'; });
    if (SES) { SES.fx('yildiz'); SES.soyle(y === 3 ? 'Harika! Üç yıldız!' : 'Aferin sana!', 'tr'); }
    alan.querySelector('[data-kdbtekrar]').addEventListener('click', function () { if (SES) SES.fx('dokun'); oyun(x); });
    alan.querySelector('[data-kdbbitti]').addEventListener('click', function () { if (SES) SES.fx('dokun'); bahce(); });
  }

  /* seslendirme kataloğu */
  function cumleler() {
    var tr = ['Dinle ve Bul! Bir balona dokun.', 'Önce bir önceki balonu bitir.', 'Dinle ve doğru resme dokun!', 'Harika! Üç yıldız!', 'Aferin sana!'], en = [];
    KONU.forEach(function (x) { x.s.forEach(function (q) { if (en.indexOf(q[0]) < 0) en.push(q[0]); }); });
    return { tr: tr, en: en };
  }
  function ac(o) { C = W.KIDS_CIZ; SES = W.KIDS_SES; R = W.KIDS_RESIM; oz = o; if (o.dur) o.dur(); bahce(); return { dur: dur }; }
  W.KIDS_DINLEBUL = { ac: ac, KONU: KONU, kartCoz: kartCoz, yildiz: yildiz, konuAcik: konuAcik, cumleler: cumleler };
})(window);
