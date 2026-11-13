/* ==========================================================================
   ACADEX KIDS · animasyonlu anlatım (kids/assets/kids-anlat.js), 12.11.2026
   "İzle" durağı: her kelime küçük bir sahnede canlanır, Acadia öğretmen gibi anlatır.
   - Sahne: konunun dünyası (kids-resim dunya) önünde bir sahne kartı. Kelime konuya
     özgü bir hareketle girer: Colours'ta fırça boyar, Animals'ta yürüyerek gelir,
     Weather'da gökten iner, Transport'ta yoldan geçer, ABC'de harf çizilerek yazılır,
     Numbers'ta yıldızlar tek tek sayılır, Feelings'te yüz takla atıp belirir…
   - Kelime harf harf zıplayarak yazılır (yazı gösterilen yaş dünyalarında).
   - Acadia sahnenin kenarında konuşur (ağzı söylerken oynar), cümleyi söyler;
     sonra "senin sıran" anında mikrofon simgesi yanıp söner, çocuk tekrar eder.
   13.11.2026: konuşan kelimeler + Acadia ile diyalog + mini hikâye (kids-konusan.js):
     Acadia "Who are you?" sorar → kelime (hayvansa önce sesi: hav, miyav) "Woof, woof! I'm a dog!"
     der, konuşurken zıplar ve kendi balonunda yazar → Acadia el sallar "Hello, dog!" →
     sahneye bir eşya gelir (top, sepet, tabak, yol…) ve Acadia hikâye cümlesini söyler.
   Ses metinleri konunun paketinden ve KIDS_KONUSAN'dan gelir; hepsi katalogda.
   W.KIDS_ANLAT.izle(sahne, {paket, ogeler, bant, konu, ileri, acd}) → {dur()}
   ========================================================================== */
(function (W) {
  'use strict';
  var C = W.KIDS_CIZ, R = W.KIDS_RESIM, SES = W.KIDS_SES, KS = W.KIDS_KONUSAN;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  /* konu → giriş hareketi */
  var HAREKET = {
    colours: 'boya', numbers: 'say', animals: 'yuru', sea: 'yuz', family: 'buyu', jobs: 'buyu', body: 'buyu', feelings: 'takla',
    food: 'dus', fruits: 'dus', toys: 'zipla', clothes: 'salla', home: 'kur', school: 'kur', shapes: 'don', places: 'zipla',
    weather: 'in', seasons: 'in', transport: 'gec', actions: 'zipla', days: 'yaz', alphabet: 'yaz'
  };
  function bekle(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function harfler(s) { var i = 0; return String(s).split('').map(function (c) { return c === ' ' ? '<span class="kn-bosluk"> </span>' : '<span style="--h:' + (i++) + '">' + esc(c) + '</span>'; }).join(''); }
  function azHareket() { return W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  function izle(sahne, o) {
    var P = o.paket, rs = o.ogeler, iptal = false, hareket = HAREKET[o.konu] || 'zipla', yazi = o.bant.yazi;
    sahne.innerHTML = '<div class="kn" data-kn>' +
      '<div class="kn-sahne kn-h-' + hareket + '" data-sahnek><div class="kn-arka" aria-hidden="true">' + (R.dunya ? R.dunya(o.konu) : '') + '</div>' +
      '<div class="kn-isik" aria-hidden="true"></div><div class="kn-hikaye" data-hikaye aria-hidden="true"></div><div class="kn-oge" data-oge></div><p class="kn-oge-balon" data-obalon lang="en" hidden></p><div class="kn-kivilcim" aria-hidden="true">' + new Array(9).join('<i></i>') + '</div>' +
      '<p class="kn-kelime" data-kelime lang="en" aria-live="polite"></p></div>' +
      '<div class="kn-ogretmen"><div class="kn-acd" data-acd>' + o.acd('mutlu', 'isaret') + '</div><p class="kn-balon" data-balon lang="en"></p>' +
      '<span class="kn-sira-sen" data-sen hidden>' + C.simge('mikrofon') + '<b>Senin sıran!</b></span></div>' +
      '<ol class="kn-sira" data-sira>' + rs.map(function (r, i) { return '<li style="--r:' + (r.hex || '#9AA7BD') + '"><button type="button" data-git="' + i + '" aria-label="' + esc(r.en) + '">' + P.gorsel(r) + '</button></li>'; }).join('') + '</ol>' +
      '<div class="ka-izle-alt" data-alt hidden><button type="button" class="ka-orta" data-yeniden>Bir daha izle</button>' + o.ileriDugme + '</div></div>';
    var kok = sahne.querySelector('[data-kn]'), sk = sahne.querySelector('[data-sahnek]'), oge = sahne.querySelector('[data-oge]'), kel = sahne.querySelector('[data-kelime]'),
      balon = sahne.querySelector('[data-balon]'), obalon = sahne.querySelector('[data-obalon]'), hik = sahne.querySelector('[data-hikaye]'), acdK = sahne.querySelector('[data-acd]'), sen = sahne.querySelector('[data-sen]'), sira = sahne.querySelector('[data-sira]'), alt = sahne.querySelector('[data-alt]'), kosu = 0;
    /* Acadia konuşurken ağzı oynar */
    function soyle(metin, ek) { acdK.classList.add('kn-konus'); if (yazi) balon.textContent = metin; return SES.soyle(metin, 'en', ek).then(function (x) { acdK.classList.remove('kn-konus'); return x; }); }
    /* kelimenin kendi sesi: biraz daha ince ses (yedek seste), konuşurken zıplar, kendi balonunda yazar */
    function ogeSoyle(metin) {
      balon.textContent = ''; obalon.hidden = false; obalon.classList.toggle('kn-noktalar', !yazi);
      obalon.innerHTML = yazi ? esc(metin) : '<i></i><i></i><i></i>';
      sk.classList.add('kn-oge-konus');
      return SES.soyle(metin, 'en', { perde: 1.5 }).then(function (x) { sk.classList.remove('kn-oge-konus'); return x; });
    }
    function hikayeBasla(ad) {
      if (!ad || !KS) return;
      hik.innerHTML = '<span class="kn-esya kn-e-' + ad + '">' + KS.esya(ad) + '</span>' + (ad === 'kalp' || ad === 'kabarcik' || ad === 'pirilti' ? '<span class="kn-ucus">' + new Array(6).join('<i>' + KS.esya(ad) + '</i>') + '</span>' : '');
      sk.className = sk.className.replace(/ ?kn-hk-\S+/g, ''); void sk.offsetWidth; sk.classList.add('kn-hk', 'kn-hk-' + ad);
    }
    function hikayeBitir() { hik.innerHTML = ''; obalon.hidden = true; sk.className = sk.className.replace(/ ?kn-hk(-\S+)?/g, ''); }
    function sahneCiz(r) {
      var ic = W.KIDS_HAYVAN ? W.KIDS_HAYVAN.en(r, P) : P.gorsel(r), n = r.n || 0, ek = '';
      if (hareket === 'say' && n) { var s = ''; for (var i = 0; i < n; i++) s += '<i style="--s:' + i + '">' + C.simge('yildiz') + '</i>'; ek = '<div class="kn-sayilar kn-n' + (n > 10 ? 'c' : n > 5 ? 'o' : 'a') + '">' + s + '</div>'; }
      if (hareket === 'boya') ek = '<span class="kn-firca" aria-hidden="true">' + C.simge('firca') + '</span>';
      if (hareket === 'gec' || hareket === 'yuru') ek = '<span class="kn-toz" aria-hidden="true"><i></i><i></i><i></i></span>';
      if (hareket === 'in' && r.id !== 'sunny' && r.id !== 'sun') ek = '<span class="kn-yagis" aria-hidden="true">' + new Array(7).join('<i></i>') + '</span>';
      oge.innerHTML = '<div class="kn-resim" style="--r:' + (r.hex || '#9AA7BD') + '">' + ic + '</div>' + ek;
      sk.style.setProperty('--r', r.hex || '#9AA7BD');
      sk.classList.remove('kn-gir', 'kn-durgun'); void sk.offsetWidth; sk.classList.add('kn-gir');
    }
    async function bir(i, benim) {
      var r = rs[i];
      [].forEach.call(sira.children, function (x, j) { x.classList.toggle('kn-bu', j === i); if (j < i) x.classList.add('kn-gordu'); });
      var rp = KS ? KS.replik(o.konu, r, P) : null, dur = function () { return iptal || benim !== kosu; };
      kel.innerHTML = ''; sen.hidden = true; acdK.innerHTML = o.acd('mutlu', 'isaret'); hikayeBitir();
      sahneCiz(r); SES.fx('pat');
      await bekle(azHareket() ? 100 : 900); if (dur()) return false;
      /* giriş bitti: konuşma/hikâye animasyonu kalkınca giriş baştan oynamasın */
      sk.classList.add('kn-durgun');
      function yaz() { kel.innerHTML = yazi ? harfler(r.en) : ''; kel.classList.remove('kn-yaz'); void kel.offsetWidth; kel.classList.add('kn-yaz'); }
      if (rp) {
        /* diyalog: Acadia sorar, kelime kendini tanıtır, Acadia selam verir */
        await soyle(rp.soru); if (dur()) return false;
        var hs = KS.hayvanSesi(r);
        if (hs) { sk.classList.add('kn-oge-konus'); await (SES.hayvan ? SES.hayvan(hs) : bekle(900)); sk.classList.remove('kn-oge-konus'); if (dur()) return false; await bekle(150); }
        yaz(); await ogeSoyle(rp.ben); if (dur()) return false; await bekle(200);
        if (rp.selam) { acdK.innerHTML = o.acd('mutlu', 'el'); await soyle(rp.selam); if (dur()) return false; }
        obalon.hidden = true;
        /* mini hikâye: eşya sahneye gelir, kelime onunla oynar */
        if (rp.hikaye) { acdK.innerHTML = o.acd('mutlu', 'isaret'); hikayeBasla(rp.sahne); await bekle(azHareket() ? 100 : 500); if (dur()) return false; await soyle(rp.hikaye, { hiz: 0.9 }); if (dur()) return false; await bekle(400); }
      } else {
        yaz(); await soyle(r.en + '.'); if (dur()) return false; await bekle(250);
        await soyle(P.izleCumle(r), { hiz: 0.9 }); if (dur()) return false;
      }
      hikayeBitir();
      /* senin sıran: kelime tekrar edilir, çocuk söyler */
      sen.hidden = false; acdK.innerHTML = o.acd('dusun'); sk.classList.add('kn-dinle');
      await bekle(400); if (iptal || benim !== kosu) return false;
      await soyle(r.en + '!'); if (iptal || benim !== kosu) return false;
      await bekle(1500); sk.classList.remove('kn-dinle'); sen.hidden = true;
      if (iptal || benim !== kosu) return false;
      sira.children[i].classList.add('kn-gordu'); return true;
    }
    async function oyna(bas) {
      var benim = ++kosu; alt.hidden = true;
      if (!bas) { acdK.classList.add('kn-konus'); await soyle(P.izleGiris); if (iptal || benim !== kosu) return; await soyle('Repeat after me!'); if (iptal || benim !== kosu) return; }
      for (var i = bas || 0; i < rs.length; i++) { var ok = await bir(i, benim); if (!ok) return; await bekle(300); }
      hikayeBitir(); acdK.innerHTML = o.acd('kutlama'); balon.textContent = ''; alt.hidden = false; SES.fx('dogru'); kok.classList.add('kn-bitti');
      var b = alt.querySelector('[data-ileri]'); if (b) b.focus({ preventScroll: true });
    }
    /* sıradaki küçük resimlere dokunarak o kelimeye atla */
    sira.addEventListener('click', function (e) { var b = e.target.closest('[data-git]'); if (!b) return; SES.sus(); SES.fx('dokun'); oyna(+b.getAttribute('data-git')); });
    oge.addEventListener('click', function () { var i = [].indexOf.call(sira.children, sira.querySelector('.kn-bu')); if (i < 0) return; SES.fx('dokun'); sk.classList.remove('kn-zipla'); void sk.offsetWidth; sk.classList.add('kn-zipla'); var h = KS && KS.hayvanSesi(rs[i]), b = KS && KS.ben(o.konu, rs[i], P); (h && SES.hayvan ? SES.hayvan(h) : Promise.resolve()).then(function () { if (b) return ogeSoyle(b).then(function () { obalon.hidden = true; }); return SES.soyle(rs[i].en, 'en'); }); });
    sahne.querySelector('[data-yeniden]').addEventListener('click', function () { SES.fx('dokun'); kok.classList.remove('kn-bitti'); oyna(0); });
    sahne.querySelector('[data-ileri]').addEventListener('click', function () { SES.fx('dokun'); o.ileri(); });
    oyna(0);
    return { dur: function () { iptal = true; SES.sus(); } };
  }
  W.KIDS_ANLAT = { izle: izle, HAREKET: HAREKET };
})(window);
