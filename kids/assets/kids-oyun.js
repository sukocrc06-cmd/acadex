/* ==========================================================================
   ACADEX KIDS · mini oyunlar (kids/assets/kids-oyun.js), 10.11.2026
   Balon patlat, hafıza kartları, boyama. Her oyun: OYUN.ad(kok, ayar) → {dur()}
   ayar: {renkler:[{id,en,tr,hex}], bant:{yazi,secenek,tur,cift,kelimeKart}, bitti(yildiz), yanlis(kelimeId)}
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
  function balon(kok, a) {
    var renk = a.renkler, tur = 0, yanlis = 0, hedef = null, bitti = false, kilit = false, son = null;
    kok.innerHTML = '<div class="ko ko-balon">' + yonerge('', a.bant.yazi) + '<div class="ko-gok" data-ko-alan></div></div>';
    var alan = kok.querySelector('[data-ko-alan]'), soz = kok.querySelector('[data-ko-soz]'), tn = kok.querySelector('[data-ko-tur]');
    function sor() { soz.innerHTML = 'Pop the <b style="--r:' + hedef.hex + '">' + hedef.en + '</b> balloon!'; return SES.soyle('Pop the ' + hedef.en + ' balloon!', 'en'); }
    function yeni() {
      if (tur >= a.bant.tur) { bitti = true; return a.bitti(yildizHesap(yanlis, [1, 3])); }
      kilit = false; turNokta(tn, tur, a.bant.tur);
      var aday = renk.filter(function (r) { return r !== son; }); hedef = aday[Math.floor(Math.random() * aday.length)]; son = hedef;
      var sec = kar([hedef].concat(kar(renk.filter(function (r) { return r !== hedef; })).slice(0, a.bant.secenek - 1)));
      alan.innerHTML = sec.map(function (r, i) { return '<button type="button" class="ko-b" data-ko-renk="' + r.id + '" style="--i:' + i + ';--n:' + sec.length + '" aria-label="' + r.en + '">' + C.balon(r.hex) + '</button>'; }).join('');
      sor();
    }
    function dokun(e) {
      var b = e.target.closest('[data-ko-renk]'); if (!b || kilit || bitti) return;
      var id = b.getAttribute('data-ko-renk');
      if (id === hedef.id) {
        kilit = true; SES.fx('pat'); b.classList.add('ko-pat'); tur++;
        SES.soyle(hedef.en + '!', 'en').then(function () { if (!bitti) setTimeout(yeni, 250); });
      } else { yanlis++; if (a.yanlis) a.yanlis(hedef.id); SES.fx('yanlis'); salla(b); var y = renk.filter(function (r) { return r.id === id; })[0]; SES.soyle('That is ' + y.en + '. Find ' + hedef.en + '!', 'en'); }
    }
    alan.addEventListener('click', dokun);
    kok.querySelector('[data-ko-dinle]').addEventListener('click', function () { SES.fx('dokun'); sor(); });
    yeni();
    return { dur: function () { bitti = true; SES.sus(); } };
  }

  /* ---------------- 2. hafıza kartları ---------------- */
  function hafiza(kok, a) {
    var cift = kar(a.renkler).slice(0, Math.min(a.bant.cift, a.renkler.length)), kartlar = [], acik = [], bulunan = 0, deneme = 0, kilit = false, bitti = false;
    cift.forEach(function (r) { kartlar.push({ r: r, t: 'leke' }); kartlar.push({ r: r, t: a.bant.kelimeKart ? 'kelime' : 'leke' }); });
    kartlar = kar(kartlar);
    kok.innerHTML = '<div class="ko ko-hafiza">' + yonerge('Find the same colours!', a.bant.yazi) + '<div class="ko-kartlar ko-k' + kartlar.length + '" data-ko-alan>' +
      kartlar.map(function (k, i) { return '<button type="button" class="ko-kart" data-ko-i="' + i + '" aria-label="Kart ' + (i + 1) + '"><span class="ko-arka">' + C.simge('yildiz') + '</span><span class="ko-on">' + (k.t === 'kelime' ? '<b lang="en" style="--r:' + k.r.hex + '">' + k.r.en + '</b>' : C.leke(k.r.hex)) + '</span></button>'; }).join('') + '</div></div>';
    var alan = kok.querySelector('[data-ko-alan]');
    SES.soyle('Find the same colours!', 'en');
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
    kok.querySelector('[data-ko-dinle]').addEventListener('click', function () { SES.fx('dokun'); SES.soyle('Find the same colours!', 'en'); });
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

  W.KIDS_OYUN = { balon: balon, hafiza: hafiza, boyama: boyama, kar: kar, yildizHesap: yildizHesap, BOYA_GOREV: BOYA_GOREV };
})(window);
