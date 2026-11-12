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
   Ses metinleri konunun paketinden (izleGiris, izleCumle) gelir; katalogda zaten var.
   W.KIDS_ANLAT.izle(sahne, {paket, ogeler, bant, konu, ileri, acd}) → {dur()}
   ========================================================================== */
(function (W) {
  'use strict';
  var C = W.KIDS_CIZ, R = W.KIDS_RESIM, SES = W.KIDS_SES;
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
      '<div class="kn-isik" aria-hidden="true"></div><div class="kn-oge" data-oge></div><div class="kn-kivilcim" aria-hidden="true">' + new Array(9).join('<i></i>') + '</div>' +
      '<p class="kn-kelime" data-kelime lang="en" aria-live="polite"></p></div>' +
      '<div class="kn-ogretmen"><div class="kn-acd" data-acd>' + o.acd('mutlu', 'isaret') + '</div><p class="kn-balon" data-balon lang="en"></p>' +
      '<span class="kn-sira-sen" data-sen hidden>' + C.simge('mikrofon') + '<b>Senin sıran!</b></span></div>' +
      '<ol class="kn-sira" data-sira>' + rs.map(function (r, i) { return '<li style="--r:' + (r.hex || '#9AA7BD') + '"><button type="button" data-git="' + i + '" aria-label="' + esc(r.en) + '">' + P.gorsel(r) + '</button></li>'; }).join('') + '</ol>' +
      '<div class="ka-izle-alt" data-alt hidden><button type="button" class="ka-orta" data-yeniden>Bir daha izle</button>' + o.ileriDugme + '</div></div>';
    var kok = sahne.querySelector('[data-kn]'), sk = sahne.querySelector('[data-sahnek]'), oge = sahne.querySelector('[data-oge]'), kel = sahne.querySelector('[data-kelime]'),
      balon = sahne.querySelector('[data-balon]'), acdK = sahne.querySelector('[data-acd]'), sen = sahne.querySelector('[data-sen]'), sira = sahne.querySelector('[data-sira]'), alt = sahne.querySelector('[data-alt]'), kosu = 0;
    /* Acadia konuşurken ağzı oynar */
    function soyle(metin, ek) { acdK.classList.add('kn-konus'); if (yazi) balon.textContent = metin; return SES.soyle(metin, 'en', ek).then(function (x) { acdK.classList.remove('kn-konus'); return x; }); }
    function sahneCiz(r) {
      var ic = P.gorsel(r), n = r.n || 0, ek = '';
      if (hareket === 'say' && n) { var s = ''; for (var i = 0; i < n; i++) s += '<i style="--s:' + i + '">' + C.simge('yildiz') + '</i>'; ek = '<div class="kn-sayilar kn-n' + (n > 10 ? 'c' : n > 5 ? 'o' : 'a') + '">' + s + '</div>'; }
      if (hareket === 'boya') ek = '<span class="kn-firca" aria-hidden="true">' + C.simge('firca') + '</span>';
      if (hareket === 'gec' || hareket === 'yuru') ek = '<span class="kn-toz" aria-hidden="true"><i></i><i></i><i></i></span>';
      if (hareket === 'in' && r.id !== 'sunny' && r.id !== 'sun') ek = '<span class="kn-yagis" aria-hidden="true">' + new Array(7).join('<i></i>') + '</span>';
      oge.innerHTML = '<div class="kn-resim" style="--r:' + (r.hex || '#9AA7BD') + '">' + ic + '</div>' + ek;
      sk.style.setProperty('--r', r.hex || '#9AA7BD');
      sk.classList.remove('kn-gir'); void sk.offsetWidth; sk.classList.add('kn-gir');
    }
    async function bir(i, benim) {
      var r = rs[i];
      [].forEach.call(sira.children, function (x, j) { x.classList.toggle('kn-bu', j === i); if (j < i) x.classList.add('kn-gordu'); });
      kel.innerHTML = ''; sen.hidden = true; acdK.innerHTML = o.acd('mutlu', 'isaret');
      sahneCiz(r); SES.fx('pat');
      await bekle(azHareket() ? 100 : 900); if (iptal || benim !== kosu) return false;
      kel.innerHTML = yazi ? harfler(r.en) : ''; kel.classList.remove('kn-yaz'); void kel.offsetWidth; kel.classList.add('kn-yaz');
      await soyle(r.en + '.'); if (iptal || benim !== kosu) return false; await bekle(250);
      await soyle(P.izleCumle(r), { hiz: 0.9 }); if (iptal || benim !== kosu) return false;
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
      acdK.innerHTML = o.acd('kutlama'); balon.textContent = ''; alt.hidden = false; SES.fx('dogru'); kok.classList.add('kn-bitti');
      var b = alt.querySelector('[data-ileri]'); if (b) b.focus({ preventScroll: true });
    }
    /* sıradaki küçük resimlere dokunarak o kelimeye atla */
    sira.addEventListener('click', function (e) { var b = e.target.closest('[data-git]'); if (!b) return; SES.sus(); SES.fx('dokun'); oyna(+b.getAttribute('data-git')); });
    oge.addEventListener('click', function () { var i = [].indexOf.call(sira.children, sira.querySelector('.kn-bu')); if (i < 0) return; SES.fx('dokun'); sk.classList.remove('kn-zipla'); void sk.offsetWidth; sk.classList.add('kn-zipla'); SES.soyle(rs[i].en, 'en'); });
    sahne.querySelector('[data-yeniden]').addEventListener('click', function () { SES.fx('dokun'); kok.classList.remove('kn-bitti'); oyna(0); });
    sahne.querySelector('[data-ileri]').addEventListener('click', function () { SES.fx('dokun'); o.ileri(); });
    oyna(0);
    return { dur: function () { iptal = true; SES.sus(); } };
  }
  W.KIDS_ANLAT = { izle: izle, HAREKET: HAREKET };
})(window);
