/* ==========================================================================
   ACADEX KIDS · mini oyunlar (kids/assets/kids-oyun.js), 10.11.2026
   Balon patlat, hafıza kartları, boyama. Her oyun: OYUN.ad(kok, ayar) → {dur()}
   ayar: {renkler:[{id,en,tr,hex}], bant:{yazi,secenek,tur,cift,kelimeKart}, bitti(yildiz), yanlis(kelimeId),
          paket?: KIDS_KONU paketi (yoksa Colours davranışı: renkli balon ve leke)}
   Oyunlar: balon, hafiza, boyama (Colours), say (Numbers: nesneleri say, rakama dokun).
   On temanın üçüncü oyunları kids-oyun2.js'de (aynı yardımcılarla).
   Kurallar: yalnız dokunma; yanlışta ceza yok (hafif sallanır, soru yinelenir);
   her dokunuşa ses ve hareket; yönerge her zaman hoparlörle yeniden dinlenir.
   Tanıtım sayfasındaki demo da aynı balon oyununu kullanır. W.KIDS_OYUN
   ========================================================================== */
(function (W) {
  'use strict';
  var C = W.KIDS_CIZ, SES = W.KIDS_SES;
  function kar(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function yildizHesap(yanlis, esik) { return yanlis <= esik[0] ? 3 : yanlis <= esik[1] ? 2 : 1; }
  function salla(el) { el.classList.remove('ko-salla'); void el.offsetWidth; el.classList.add('ko-salla'); }
  function yonerge(metin, yazi) {
    return '<div class="ko-yonerge"><button type="button" class="ko-dinle" data-ko-dinle aria-label="Tekrar dinle">' + C.simge('ses') + '</button>' +
      '<p class="ko-soz' + (yazi ? '' : ' ko-gizli') + '" data-ko-soz lang="en">' + metin + '</p><span class="ko-tur" data-ko-tur></span></div>';
  }
  function turNokta(el, i, n) { var h = ''; for (var k = 0; k < n; k++) h += '<i class="' + (k < i ? 'ko-dolu' : k === i ? 'ko-simdi' : '') + '"></i>'; el.innerHTML = h; }

  /* ---------------- 1. balon patlat ---------------- */
  var RENK_PAKET = {
    balon: { soz: function (o) { return 'Pop the ' + o.en + ' balloon!'; }, html: function (o) { return 'Pop the <b style="--r:' + o.hex + '">' + o.en + '</b> balloon!'; }, ciz: function (o) { return C.balon(o.hex); } },
    hafiza: { soz: 'Find the same colours!', a: function (o) { return C.leke(o.hex); }, b: function (o, bant) { return bant.kelimeKart ? '<b lang="en" style="--r:' + o.hex + '">' + o.en + '</b>' : C.leke(o.hex); } }
  };
  function balon(kok, a) {
    var B = (a.paket || RENK_PAKET).balon, renk = a.renkler, tur = 0, yanlis = 0, hedef = null, bitti = false, kilit = false, son = null;
    kok.innerHTML = '<div class="ko ko-balon">' + yonerge('', a.bant.yazi) + '<div class="ko-gok" data-ko-alan></div></div>';
    var alan = kok.querySelector('[data-ko-alan]'), soz = kok.querySelector('[data-ko-soz]'), tn = kok.querySelector('[data-ko-tur]');
    function sor() { soz.innerHTML = B.html(hedef); return SES.soyle(B.soz(hedef), 'en'); }
    function yeni() {
      if (tur >= a.bant.tur) { bitti = true; return a.bitti(yildizHesap(yanlis, [1, 3])); }
      kilit = false; turNokta(tn, tur, a.bant.tur);
      var aday = renk.filter(function (r) { return r !== son; }); hedef = aday[Math.floor(Math.random() * aday.length)]; son = hedef;
      var sec = kar([hedef].concat(kar(renk.filter(function (r) { return r !== hedef; })).slice(0, a.bant.secenek - 1)));
      alan.innerHTML = sec.map(function (r, i) { return '<button type="button" class="ko-b" data-ko-renk="' + r.id + '" style="--i:' + i + ';--n:' + sec.length + '" aria-label="' + r.en + '">' + B.ciz(r) + '</button>'; }).join('');
      sor();
    }
    function dokun(e) {
      var b = e.target.closest('[data-ko-renk]'); if (!b || kilit || bitti) return;
      var id = b.getAttribute('data-ko-renk');
      if (id === hedef.id) {
        kilit = true; SES.fx('pat'); b.classList.add('ko-pat'); tur++;
        SES.soyle(hedef.en + '!', 'en').then(function () { if (!bitti) setTimeout(yeni, 250); });
      } else { yanlis++; if (a.yanlis) a.yanlis(hedef.id); SES.fx('yanlis'); salla(b); var y = renk.filter(function (r) { return r.id === id; })[0];
        if (B.yanlis) { var iki = B.yanlis(y, hedef), h0 = hedef; SES.soyle(iki[0], 'en').then(function () { if (!bitti && h0 === hedef) SES.soyle(iki[1], 'en'); }); } else SES.soyle('That is ' + y.en + '. Find ' + hedef.en + '!', 'en'); }
    }
    alan.addEventListener('click', dokun);
    kok.querySelector('[data-ko-dinle]').addEventListener('click', function () { SES.fx('dokun'); sor(); });
    yeni();
    return { dur: function () { bitti = true; SES.sus(); } };
  }

  /* ---------------- 2. hafıza kartları ---------------- */
  function hafiza(kok, a) {
    var H = (a.paket || RENK_PAKET).hafiza, cift = kar(a.renkler).slice(0, Math.min(a.bant.cift, a.renkler.length)), kartlar = [], acik = [], bulunan = 0, deneme = 0, kilit = false, bitti = false;
    cift.forEach(function (r) { kartlar.push({ r: r, t: 'leke' }); kartlar.push({ r: r, t: a.paket || a.bant.kelimeKart ? 'kelime' : 'leke' }); });
    kartlar = kar(kartlar);
    kok.innerHTML = '<div class="ko ko-hafiza">' + yonerge(H.soz, a.bant.yazi) + '<div class="ko-kartlar ko-k' + kartlar.length + '" data-ko-alan>' +
      kartlar.map(function (k, i) { return '<button type="button" class="ko-kart" data-ko-i="' + i + '" aria-label="Kart ' + (i + 1) + '"><span class="ko-arka">' + C.simge('yildiz') + '</span><span class="ko-on">' + (k.t === 'kelime' ? H.b(k.r, a.bant) : H.a(k.r)) + '</span></button>'; }).join('') + '</div></div>';
    var alan = kok.querySelector('[data-ko-alan]');
    SES.soyle(H.soz, 'en');
    alan.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ko-i]'); if (!b || kilit || bitti || b.classList.contains('ko-acik')) return;
      var k = kartlar[+b.getAttribute('data-ko-i')];
      b.classList.add('ko-acik'); SES.fx('cevir'); SES.soyle(k.r.en, 'en'); acik.push({ b: b, k: k });
      if (acik.length < 2) return;
      deneme++; kilit = true; var x = acik[0], y = acik[1]; acik = [];
      if (x.k.r === y.k.r) {
        setTimeout(function () { x.b.classList.add('ko-bulundu'); y.b.classList.add('ko-bulundu'); SES.fx('dogru'); kilit = false; bulunan++;
          if (bulunan === cift.length) { bitti = true; setTimeout(function () { a.bitti(yildizHesap(deneme - cift.length, [2, 5])); }, 700); } }, 450);
      } else setTimeout(function () { x.b.classList.remove('ko-acik'); y.b.classList.remove('ko-acik'); kilit = false; }, 1100);
    });
    kok.querySelector('[data-ko-dinle]').addEventListener('click', function () { SES.fx('dokun'); SES.soyle(H.soz, 'en'); });
    return { dur: function () { bitti = true; SES.sus(); } };
  }

  /* ---------------- 3. boyama ---------------- */
  var BOYA_GOREV = [['sun', 'yellow'], ['tree', 'green'], ['apple', 'red'], ['ball', 'blue']];
  function boyama(kok, a) {
    var gorev = BOYA_GOREV.filter(function (g) { return a.renkler.some(function (r) { return r.id === g[1]; }); }), palet = a.renkler, i = 0, secili = null, yanlis = 0, bitti = false;
    kok.innerHTML = '<div class="ko ko-boyama">' + yonerge('', a.bant.yazi) + '<div class="ko-tuval" data-ko-tuval>' + C.boyamaResmi() + '</div>' +
      '<div class="ko-palet" role="radiogroup" aria-label="Renkler">' + palet.map(function (r) { return '<button type="button" role="radio" aria-checked="false" class="ko-boya" data-ko-renk="' + r.id + '" aria-label="' + r.en + '">' + C.leke(r.hex) + '</button>'; }).join('') + '</div></div>';
    var soz = kok.querySelector('[data-ko-soz]'), tn = kok.querySelector('[data-ko-tur]'), tuval = kok.querySelector('[data-ko-tuval]');
    function rb(id) { return palet.filter(function (r) { return r.id === id; })[0]; }
    function sor() { var g = gorev[i]; soz.innerHTML = 'Colour the ' + g[0] + ' <b style="--r:' + rb(g[1]).hex + '">' + g[1] + '</b>.'; return SES.soyle('Colour the ' + g[0] + ' ' + g[1] + '.', 'en'); }
    function yeni() {
      if (i >= gorev.length) { bitti = true; return setTimeout(function () { a.bitti(yildizHesap(yanlis, [1, 3])); }, 600); }
      turNokta(tn, i, gorev.length); tuval.querySelectorAll('[data-parca]').forEach(function (p) { p.classList.toggle('ko-hedef', p.getAttribute('data-parca') === gorev[i][0]); }); sor();
    }
    kok.querySelector('.ko-palet').addEventListener('click', function (e) {
      var b = e.target.closest('[data-ko-renk]'); if (!b || bitti) return;
      secili = rb(b.getAttribute('data-ko-renk')); SES.fx('dokun'); SES.soyle(secili.en, 'en');
      kok.querySelectorAll('.ko-boya').forEach(function (x) { x.setAttribute('aria-checked', x === b); });
    });
    function parca(p) {
      if (bitti || !p) return; var g = gorev[i];
      if (!secili) { salla(kok.querySelector('.ko-palet')); return; }
      if (p.getAttribute('data-parca') === g[0] && secili.id === g[1]) {
        p.querySelectorAll('circle,path[fill="#fff"],rect').forEach(function (s) { if (s.getAttribute('fill') === '#fff') s.setAttribute('fill', secili.hex); });
        p.classList.add('ko-boyandi'); p.classList.remove('ko-hedef'); SES.fx('dogru'); i++;
        SES.soyle(g[1] + ' ' + g[0] + '!', 'en').then(function () { if (!bitti) yeni(); });
      } else { yanlis++; if (a.yanlis) a.yanlis(g[1]); SES.fx('yanlis'); salla(p); sor(); }
    }
    tuval.addEventListener('click', function (e) { parca(e.target.closest('[data-parca]')); });
    tuval.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); parca(e.target.closest('[data-parca]')); } });
    kok.querySelector('[data-ko-dinle]').addEventListener('click', function () { SES.fx('dokun'); sor(); });
    yeni();
    return { dur: function () { bitti = true; SES.sus(); } };
  }

  /* ---------------- 4. say (Numbers): nesneleri say, doğru rakama dokun ---------------- */
  var SAY_NESNE = [['elma', 'apples', 'apple'], ['yildiz', 'stars', 'star'], ['top', 'balls', 'ball'], ['balik', 'fish', 'fish'], ['cilek', 'strawberries', 'strawberry'], ['cicek', 'flowers', 'flower']];
  function sayCevap(o, nesne) { return o.en + ' ' + (o.n === 1 ? nesne[2] : nesne[1]) + '!'; }
  function say(kok, a) {
    var ogeler = a.renkler, tur = 0, yanlis = 0, hedef = null, nesne = null, bitti = false, kilit = false, son = null, sayac = [];
    kok.innerHTML = '<div class="ko ko-say">' + yonerge('', a.bant.yazi) + '<div class="ko-tepsi" data-ko-tepsi></div><div class="ko-rakamlar" data-ko-alan></div></div>';
    var tepsi = kok.querySelector('[data-ko-tepsi]'), alan = kok.querySelector('[data-ko-alan]'), soz = kok.querySelector('[data-ko-soz]'), tn = kok.querySelector('[data-ko-tur]');
    function sor() { soz.innerHTML = 'How many <b>' + nesne[1] + '</b>?'; return SES.soyle('How many ' + nesne[1] + '?', 'en'); }
    function temizle() { sayac.forEach(clearTimeout); sayac = []; }
    function yeni() {
      temizle();
      if (tur >= a.bant.tur) { bitti = true; return a.bitti(yildizHesap(yanlis, [1, 3])); }
      kilit = false; turNokta(tn, tur, a.bant.tur);
      var aday = ogeler.filter(function (r) { return r !== son; }); hedef = aday[Math.floor(Math.random() * aday.length)]; son = hedef;
      nesne = SAY_NESNE[Math.floor(Math.random() * SAY_NESNE.length)];
      tepsi.className = 'ko-tepsi ko-t' + hedef.n;
      tepsi.innerHTML = Array.apply(null, { length: hedef.n }).map(function (x, i) { return '<span style="--i:' + i + '">' + C.simge(nesne[0]) + '</span>'; }).join('');
      var sec = kar([hedef].concat(kar(ogeler.filter(function (r) { return r !== hedef; })).slice(0, Math.min(a.bant.secenek, 4) - 1)));
      alan.innerHTML = sec.map(function (r) { return '<button type="button" class="ko-rakam" data-ko-renk="' + r.id + '" aria-label="' + r.en + '">' + C.sayiKart(r.n, r.hex) + '</button>'; }).join('');
      sor();
    }
    /* yanlışta birlikte sayılır: her nesne sırayla zıplar */
    function birlikteSay() {
      temizle(); var ns = tepsi.children, h = hedef;
      SES.soyle('Let\'s count together!', 'en').then(function () {
        if (bitti || h !== hedef) return;
        [].forEach.call(ns, function (el, i) { sayac.push(setTimeout(function () { el.classList.remove('ko-sayildi'); void el.offsetWidth; el.classList.add('ko-sayildi'); }, i * 620)); });
        SES.soyle(W.KIDS_VERI.SAYI.slice(0, h.n).map(function (x) { return x.en; }).join(', '), 'en');
      });
    }
    alan.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ko-renk]'); if (!b || kilit || bitti) return;
      if (b.getAttribute('data-ko-renk') === hedef.id) {
        kilit = true; temizle(); SES.fx('dogru'); b.classList.add('ko-dogru'); tur++;
        SES.soyle(sayCevap(hedef, nesne), 'en').then(function () { if (!bitti) setTimeout(yeni, 300); });
      } else { yanlis++; if (a.yanlis) a.yanlis(hedef.id); SES.fx('yanlis'); salla(b); birlikteSay(); }
    });
    kok.querySelector('[data-ko-dinle]').addEventListener('click', function () { SES.fx('dokun'); sor(); });
    yeni();
    return { dur: function () { bitti = true; temizle(); SES.sus(); } };
  }

  W.KIDS_OYUN = { SAY_NESNE: SAY_NESNE, sayCevap: sayCevap, say: say, balon: balon, hafiza: hafiza, boyama: boyama, kar: kar, yildizHesap: yildizHesap, BOYA_GOREV: BOYA_GOREV, salla: salla, yonerge: yonerge, turNokta: turNokta };
})(window);
