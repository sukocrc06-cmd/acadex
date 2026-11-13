/* ==========================================================================
   ACADEX KIDS · kelime kitabım ve sahne kur (kids/assets/kids-panel2.js), 13.11.2026
   1) Kelime kitabım: çocuğun bütün kelimeleri resimli bir sözlükte. Konuya göre ya da
      A'dan Z'ye; her kelimede ustalık yıldızları. Öğrenilen kelime renkli, henüz
      öğrenilmeyen soluk; dokununca okunur. "Öğrendiklerim" süzgeci.
   2) Sahne kur: çiftlik, ev, deniz, park, okul, gökyüzü sahneleri. Çocuk alttan bir resim
      seçer, sahneye dokunur, resim oraya konur; Acadia sayar: "Two cats!". Resme dokununca
      büyür/küçülür ("Big!" / "Small!"), çöp kutusuyla kaldırılır. En çok 6 sahne kaydedilir.
   Önek kp-. W.KIDS_PANEL2.sozluk(o) / sahne(o)
   o = { kok, il(), kaydet(il), geri(), bant(), katman(html, cls), dur() }
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, C = W.KIDS_CIZ, R = W.KIDS_RESIM, V = W.KIDS_VERI, K = W.KIDS_KONU, SES = W.KIDS_SES, T = W.KIDS_TEMALAR;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function gorsel(kid, x) { return K.al(kid).gorsel(x); }

  /* ======================= kelime kitabım ======================= */
  function sozluk(o) {
    var il = o.il(), usta = il.usta || {}, mod = 'konu', secK = il.sonKonu && K.al(il.sonKonu) ? il.sonKonu : 'colours', secH = 'a', yalniz = false;
    var hepsi = []; K.PAKET.forEach(function (kid) { K.hepsi(kid).forEach(function (x) { hepsi.push({ kid: kid, x: x }); }); });
    var ogrenilen = hepsi.filter(function (h) { return (usta[h.x.id] || 0) >= 3; }).length, baslanan = hepsi.filter(function (h) { return usta[h.x.id]; }).length;
    var k = o.katman('<header class="ka-pen-bas"><h2>Kelime kitabım</h2><button type="button" class="ka-yuvarlak" data-kapat data-odak aria-label="Kapat">×</button></header>' +
      '<div class="kp-ozet"><span><b>' + hepsi.length + '</b> kelime</span><span><b>' + baslanan + '</b> tanıştın</span><span><b>' + ogrenilen + '</b> öğrendin ★★★</span></div>' +
      '<div class="ka-veli-sekme" role="tablist"><button type="button" role="tab" data-km="konu" aria-selected="true">Konulara göre</button><button type="button" role="tab" data-km="harf" aria-selected="false">A’dan Z’ye</button>' +
      '<label class="kp-yalniz"><input type="checkbox" data-kyal> Yalnız öğrendiklerim</label></div><div data-ksec></div><ul class="kp-kelimeler" data-kliste></ul>', 'kp-sozlukk');
    var el = k.el, secAlan = el.querySelector('[data-ksec]'), liste = el.querySelector('[data-kliste]');
    function kart(h) {
      var u = Math.min(3, usta[h.x.id] || 0), kz = V.konuBul(h.kid);
      return '<li class="kp-k kp-u' + u + '" style="--r:' + (h.x.hex || kz.renk) + '"><button type="button" data-ken="' + esc(h.x.en) + '"><span class="kp-res">' + gorsel(h.kid, h.x) + '</span><b lang="en">' + esc(h.x.en) + '</b><small>' + esc(h.x.tr) + '</small>' +
        '<i>' + [1, 2, 3].map(function (j) { return '<em class="' + (j <= u ? 'ka-dolu' : '') + '">★</em>'; }).join('') + '</i>' + (mod === 'harf' ? '<span class="kp-konu" style="--r:' + kz.renk + '">' + C.simge(kz.simge) + '</span>' : '') + '</button></li>';
    }
    function ciz() {
      el.querySelectorAll('[data-km]').forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-km') === mod); });
      var l;
      if (mod === 'konu') {
        secAlan.innerHTML = '<div class="ka-veli-ks">' + V.KONU.map(function (x) { var t = K.hepsi(x.id), og = t.filter(function (y) { return (usta[y.id] || 0) >= 3; }).length; return '<button type="button" data-kk="' + x.id + '" aria-pressed="' + (x.id === secK) + '" style="--r:' + x.renk + '"><span>' + C.simge(x.simge) + '</span>' + esc(x.en) + ' <small>' + og + '/' + t.length + '</small></button>'; }).join('') + '</div>';
        l = hepsi.filter(function (h) { return h.kid === secK; });
      } else {
        var harfler = 'abcdefghijklmnopqrstuvwxyz'.split('').filter(function (c) { return hepsi.some(function (h) { return h.x.en.toLowerCase().charAt(0) === c; }); });
        secAlan.innerHTML = '<div class="kp-harfler">' + harfler.map(function (c) { return '<button type="button" data-kh="' + c + '" aria-pressed="' + (c === secH) + '">' + c.toUpperCase() + c + '</button>'; }).join('') + '</div>';
        l = hepsi.filter(function (h) { return h.x.en.toLowerCase().charAt(0) === secH; }).sort(function (a, b) { return a.x.en.localeCompare(b.x.en); });
      }
      if (yalniz) l = l.filter(function (h) { return (usta[h.x.id] || 0) >= 1; });
      liste.innerHTML = l.length ? l.map(kart).join('') : '<li class="kp-bos">' + C.acadia({ mood: 'dusun' }) + '<p>Burada henüz kelime yok. Oynadıkça kelime kitabın dolacak!</p></li>';
      secAlan.querySelectorAll('[data-kk]').forEach(function (b) { b.addEventListener('click', function () { SES.fx('dokun'); secK = b.getAttribute('data-kk'); ciz(); }); });
      secAlan.querySelectorAll('[data-kh]').forEach(function (b) { b.addEventListener('click', function () { SES.fx('dokun'); secH = b.getAttribute('data-kh'); ciz(); }); });
    }
    el.querySelectorAll('[data-km]').forEach(function (b) { b.addEventListener('click', function () { SES.fx('dokun'); mod = b.getAttribute('data-km'); ciz(); }); });
    el.querySelector('[data-kyal]').addEventListener('change', function () { yalniz = this.checked; ciz(); });
    liste.addEventListener('click', function (e) { var b = e.target.closest('[data-ken]'); if (!b) return; SES.fx('dokun'); b.classList.remove('kp-zipla'); void b.offsetWidth; b.classList.add('kp-zipla'); SES.soyle(b.getAttribute('data-ken'), 'en'); });
    ciz();
  }

  /* ======================= sahne kur ======================= */
  var SAHNE = [
    { id: 'ciftlik', ad: 'Çiftlik', en: 'farm', dunya: 'animals', konular: ['animals', 'fruits', 'transport'] },
    { id: 'ev', ad: 'Ev', en: 'house', dunya: 'home', konular: ['home', 'family', 'toys', 'food'] },
    { id: 'deniz', ad: 'Deniz', en: 'sea', dunya: 'sea', konular: ['sea', 'transport', 'shapes'] },
    { id: 'park', ad: 'Park', en: 'park', dunya: 'toys', konular: ['toys', 'actions', 'animals', 'weather'] },
    { id: 'okul', ad: 'Okul', en: 'school', dunya: 'school', konular: ['school', 'jobs', 'clothes'] },
    { id: 'gok', ad: 'Gökyüzü', en: 'sky', dunya: 'weather', konular: ['weather', 'transport', 'seasons'] }
  ];
  function ogeBul(kid, id) { return K.hepsi(kid).filter(function (x) { return x.id === id; })[0]; }
  function sahne(o) {
    var il = o.il(); il.sahneler = il.sahneler || [];
    o.kok.dataset.gorunum = 'sahnekur';
    function geriDugme() { return '<button type="button" class="ka-yuvarlak" data-sgeri aria-label="Haritaya dön">' + C.simge('ev') + '</button>'; }
    o.kok.innerHTML = '<header class="ka-konu-ust">' + geriDugme() + '<h1 class="kk-bas">' + C.simge('paints') + ' Sahne kur</h1><span></span></header>' +
      '<main class="ka-sahne kp-sec"><p class="kk-alt">Bir sahne seç, resimleri istediğin yere koy. Acadia sana anlatsın!</p><ul class="kp-sahneler">' +
      SAHNE.map(function (s, i) { return '<li><button type="button" class="kp-sahne-b" data-sh="' + s.id + '" style="--i:' + i + '"><span class="kp-sahne-r">' + R.dunya(s.dunya) + '</span><b>' + s.ad + '</b><small lang="en">' + s.en + '</small></button></li>'; }).join('') + '</ul>' +
      (il.sahneler.length ? '<h3 class="ka-album-bas">Sahnelerim <small>' + il.sahneler.length + ' / 6</small></h3><ul class="kp-sahneler kp-kayitli">' + il.sahneler.map(function (k, i) { var s = SAHNE.filter(function (x) { return x.id === k.s; })[0] || SAHNE[0]; return '<li><button type="button" class="kp-sahne-b" data-shk="' + i + '"><span class="kp-sahne-r">' + R.dunya(s.dunya) + onizle(k) + '</span><b>' + s.ad + '</b><small>' + k.o.length + ' resim</small></button></li>'; }).join('') + '</ul>' : '') + '</main>';
    o.kok.querySelector('[data-sgeri]').addEventListener('click', function () { SES.fx('dokun'); o.geri(); });
    o.kok.querySelectorAll('[data-sh]').forEach(function (b) { b.addEventListener('click', function () { SES.fx('dokun'); kur(o, SAHNE.filter(function (x) { return x.id === b.getAttribute('data-sh'); })[0], null); }); });
    o.kok.querySelectorAll('[data-shk]').forEach(function (b) { b.addEventListener('click', function () { SES.fx('dokun'); var k = il.sahneler[+b.getAttribute('data-shk')]; kur(o, SAHNE.filter(function (x) { return x.id === k.s; })[0] || SAHNE[0], k, +b.getAttribute('data-shk')); }); });
    SES.soyle('Hadi bir sahne kuralım!', 'tr');
  }
  function onizle(k) { return '<span class="kp-onizle">' + k.o.slice(0, 12).map(function (x) { var y = ogeBul(x[0], x[1]); return y ? '<i style="left:' + x[2] + '%;top:' + x[3] + '%;--s:' + x[4] + '">' + K.al(x[0]).gorsel(y) + '</i>' : ''; }).join('') + '</span>'; }
  function kur(o, S, kayit, kayitI) {
    var bant = o.bant(), tepsi = [], sec = null, sil = false, yerler = kayit ? kayit.o.map(function (x) { return x.slice(); }) : [];
    S.konular.forEach(function (kid) { K.hepsi(kid).forEach(function (x) { if (R.var(x.id) || kid === 'colours') tepsi.push({ kid: kid, x: x }); }); });
    o.kok.innerHTML = '<header class="ka-konu-ust"><button type="button" class="ka-yuvarlak" data-sgeri aria-label="Sahnelere dön">' + C.simge('geri') + '</button><h1 class="kk-bas">' + esc(S.ad) + ' <small lang="en">' + S.en + '</small></h1>' +
      '<span class="kp-arac"><button type="button" class="ka-yuvarlak" data-ssil aria-pressed="false" aria-label="Kaldır">🗑</button><button type="button" class="ka-orta" data-skaydet>Kaydet</button></span></header>' +
      '<main class="ka-sahne kp-kur"><div class="kp-tuval" data-tuval aria-label="Sahne"><div class="kp-arka">' + R.dunya(S.dunya) + '</div><div class="kp-yerler" data-yerler></div><span class="kp-acd" data-acd>' + C.acadia({ mood: 'mutlu', pose: 'isaret' }) + '</span><p class="kp-soz" data-soz lang="en"></p></div>' +
      '<div class="kp-konu-sec" data-tk></div><ul class="kp-tepsi" data-tepsi></ul></main>';
    var tuval = o.kok.querySelector('[data-tuval]'), yerEl = o.kok.querySelector('[data-yerler]'), tepsiEl = o.kok.querySelector('[data-tepsi]'), soz = o.kok.querySelector('[data-soz]'), acd = o.kok.querySelector('[data-acd]'), tk = o.kok.querySelector('[data-tk]'), secKonu = S.konular[0];
    function soyle(metin) { soz.textContent = metin; acd.classList.add('kn-konus'); return SES.soyle(metin, 'en').then(function () { acd.classList.remove('kn-konus'); }); }
    function sayiSoyle(h) {
      var n = yerler.filter(function (y) { return y[1] === h.x.id; }).length;
      if (n <= 1 || !T.karisikUygun(h.x)) return soyle(h.x.en + '!');
      var p = [V.SAYI[Math.min(n, 20) - 1].en, T.cogul(h.x) + '!']; soz.textContent = p.join(' '); acd.classList.add('kn-konus');
      return SES.dizi(p, 'en').then(function () { acd.classList.remove('kn-konus'); });
    }
    function yerCiz(yeni) {
      yerEl.innerHTML = yerler.map(function (y, i) { var x = ogeBul(y[0], y[1]); return x ? '<button type="button" class="kp-yer' + (i === yeni ? ' kp-yeni' : '') + '" data-yi="' + i + '" style="left:' + y[2] + '%;top:' + y[3] + '%;--s:' + y[4] + '" aria-label="' + esc(x.en) + '">' + K.al(y[0]).gorsel(x) + '</button>' : ''; }).join('');
    }
    function tepsiCiz() {
      tk.innerHTML = S.konular.map(function (kid) { var kz = V.konuBul(kid); return '<button type="button" data-tkk="' + kid + '" aria-pressed="' + (kid === secKonu) + '" style="--r:' + kz.renk + '"><span>' + C.simge(kz.simge) + '</span>' + esc(kz.en) + '</button>'; }).join('');
      tepsiEl.innerHTML = tepsi.filter(function (h) { return h.kid === secKonu; }).map(function (h) { return '<li><button type="button" class="kp-t' + (sec && sec.x === h.x ? ' kp-t-sec' : '') + '" data-tid="' + h.x.id + '" aria-label="' + esc(h.x.en) + '">' + K.al(h.kid).gorsel(h.x) + (bant.yazi ? '<b lang="en">' + esc(h.x.en) + '</b>' : '') + '</button></li>'; }).join('');
      tk.querySelectorAll('[data-tkk]').forEach(function (b) { b.addEventListener('click', function () { SES.fx('dokun'); secKonu = b.getAttribute('data-tkk'); tepsiCiz(); }); });
    }
    tepsiEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tid]'); if (!b) return;
      sec = tepsi.filter(function (h) { return h.kid === secKonu && h.x.id === b.getAttribute('data-tid'); })[0]; sil = false; o.kok.querySelector('[data-ssil]').setAttribute('aria-pressed', 'false');
      SES.fx('dokun'); tepsiEl.querySelectorAll('.kp-t-sec').forEach(function (x) { x.classList.remove('kp-t-sec'); }); b.classList.add('kp-t-sec'); tuval.classList.add('kp-hazir');
      soyle(sec.x.en + '.');
    });
    tuval.addEventListener('click', function (e) {
      var yb = e.target.closest('[data-yi]');
      if (yb) {
        var i = +yb.getAttribute('data-yi'), y = yerler[i], x = ogeBul(y[0], y[1]);
        if (sil) { yerler.splice(i, 1); SES.fx('pat'); yerCiz(); return; }
        y[4] = y[4] >= 1.4 ? 0.7 : y[4] < 1 ? 1 : 1.5; SES.fx('dokun'); yerCiz(i); soyle(y[4] >= 1.4 ? 'Big!' : y[4] < 1 ? 'Small!' : x.en + '!');
        return;
      }
      if (!sec || e.target.closest('[data-acd]')) { if (!sec) { SES.fx('yanlis'); soyle('Pick a picture!'); } return; }
      if (yerler.length >= 40) { SES.fx('yanlis'); return; }
      var r = tuval.getBoundingClientRect(), px = Math.max(4, Math.min(96, (e.clientX - r.left) / r.width * 100)), py = Math.max(6, Math.min(94, (e.clientY - r.top) / r.height * 100));
      yerler.push([sec.kid, sec.x.id, +px.toFixed(1), +py.toFixed(1), 1]); SES.fx('pat'); yerCiz(yerler.length - 1); sayiSoyle(sec);
    });
    o.kok.querySelector('[data-ssil]').addEventListener('click', function () { sil = !sil; this.setAttribute('aria-pressed', sil); SES.fx('dokun'); if (sil) { sec = null; tuval.classList.remove('kp-hazir'); tepsiCiz(); } });
    o.kok.querySelector('[data-skaydet]').addEventListener('click', function () {
      var il = o.il(); il.sahneler = il.sahneler || [];
      var k = { s: S.id, o: yerler, t: Date.now() };
      if (kayitI != null && il.sahneler[kayitI]) il.sahneler[kayitI] = k; else { il.sahneler.unshift(k); il.sahneler = il.sahneler.slice(0, 6); kayitI = 0; }
      o.kaydet(il); SES.fx('yildiz'); soyle('Great picture!');
      var b = this; b.textContent = '✓ Kaydedildi'; setTimeout(function () { b.textContent = 'Kaydet'; }, 1600);
    });
    o.kok.querySelector('[data-sgeri]').addEventListener('click', function () { SES.fx('dokun'); sahne(o); });
    yerCiz(); tepsiCiz(); soyle('Pick a picture!');
  }
  W.KIDS_PANEL2 = { sozluk: sozluk, sahne: sahne, SAHNE: SAHNE };
})(window);
