/* ==========================================================================
   FORMULO · ana sayfa tanıtımı: kısa tahta dersi (formulo/assets/formulo-tanitim.js), 08.11.2026
   Profesör Acadia yaklaşık 20 saniyede Formulo'yu anlatır: kendini tanıtır, tahtaya
   bir formül yazıp şeklini çizer, kaydırıcıyı, soru havuzunu ve "Acadia'ya sor"u
   gösterir, sonda "Başla" der. Yalnız ilk girişte kendiliğinden oynar (formulo.tanitim),
   sonra son karede durur ve "Tanıtımı izle" düğmesi kalır. Atla her an var. Önek ft-.
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, FO = W.FORMULO;
  var SAKIN = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function al(k, v) { try { var x = localStorage.getItem('formulo.' + k); return x ? JSON.parse(x) : v; } catch (e) { return v; } }
  function koy(k, v) { try { localStorage.setItem('formulo.' + k, JSON.stringify(v)); } catch (e) { } }
  function dil() { return (W.FORMULO_APP && W.FORMULO_APP.dil()) || 'tr'; }
  var Y = {
    tr: { adimlar: [
        ['mutlu', 'selam', 'Merhaba! Ben Profesör Acadia. Formulo’da mühendisliğin ortak derslerini birlikte çalışacağız.'],
        ['odakli', 'isaret', 'Her formülü tahtaya yazar, şeklini çizer, adım adım anlatırım.'],
        ['odakli', 'isaret', 'Değerleri kaydır; sonuç da şekil de anında değişir.'],
        ['dusunuyor', 'dusun', 'Soru havuzu bitmez: kolaydan zora, ipucu ve adım adım çözümle.'],
        ['mutlu', 'oku', 'Takıldığın yerde bana sor. İstersen cevabı söylemeden yol gösteririm.'],
        ['kutlama', 'zipla', 'Hazırsan bir ders seç, başlayalım!']],
      atla: 'Atla', izle: 'Tanıtımı izle', basla: 'Başla', soru: 'v₀ iki katına çıkarsa R ne olur?', sen: 'menzil nedir?', cevap: 'Yatay menzil: aynı yüksekliğe düşen atışta topun gittiği uzaklık.', orta: 'Orta', hadi: 'Hadi başlayalım!', etiket: 'Formulo tanıtımı' },
    en: { adimlar: [
        ['mutlu', 'selam', 'Hi! I’m Professor Acadia. In Formulo we’ll study the shared engineering courses together.'],
        ['odakli', 'isaret', 'I write each formula on the board, draw its figure and explain it step by step.'],
        ['odakli', 'isaret', 'Slide the values; the result and the figure change instantly.'],
        ['dusunuyor', 'dusun', 'The question pool never runs out: easy to hard, with hints and worked solutions.'],
        ['mutlu', 'oku', 'Stuck? Ask me. I can guide you without giving away the answer.'],
        ['kutlama', 'zipla', 'Ready? Pick a course and let’s begin!']],
      atla: 'Skip', izle: 'Watch the intro', basla: 'Start', soru: 'If v₀ doubles, what happens to R?', sen: 'what is range?', cevap: 'Horizontal range: how far the ball travels when it lands at launch height.', orta: 'Medium', hadi: 'Let’s begin!', etiket: 'Formulo intro' }
  };
  var SURE = [4200, 4600, 4200, 4400, 4400, 0];

  function html() {
    var L = Y[dil()], f = FO.formuller.filter(function (x) { return x.id === 'menzil'; })[0];
    return '<div class="ft" data-ft role="region" aria-label="' + L.etiket + '">' +
      '<div class="ft-tahta"><div class="ft-ic">' +
        '<div class="ft-k ft-k0"><p class="ft-yazi">Formul<span>o</span></p><p class="ft-alt">∫ · d/dx · Σ · F = ma</p></div>' +
        '<div class="ft-k ft-k1"><div class="fo-f ft-f">' + (f ? f.h : '') + '</div>' +
          '<svg class="ft-sekil" viewBox="0 0 240 110" aria-hidden="true"><line x1="10" y1="100" x2="230" y2="100" class="ft-z"/><path class="ft-yol" d="M20 100 Q120 -20 220 100"/><path class="ft-ok" d="M20 100 L52 66"/><circle class="ft-top" r="6" cx="20" cy="100"/></svg></div>' +
        '<div class="ft-k ft-k2"><div class="ft-olcu"><span class="ft-sem">θ</span><span class="ft-ray"><i data-ft-ray></i></span><b data-ft-aci>30°</b></div>' +
          '<div class="ft-olcu"><span class="ft-sem">R</span><span class="ft-sonuc" data-ft-R>35,3</span><em>m</em></div></div>' +
        '<div class="ft-k ft-k3"><div class="ft-soru"><small>' + L.orta + '</small><p>' + L.soru + '</p><div class="ft-sik"><span>× 2</span><span data-ft-dogru>× 4</span><span>× ½</span></div></div></div>' +
        '<div class="ft-k ft-k4"><div class="ft-sohbet"><p class="ft-sen">' + L.sen + '</p><p class="ft-ac">' + L.cevap + '</p></div></div>' +
        '<div class="ft-k ft-k5"><p class="ft-yazi ft-hadi">' + L.hadi + '</p></div>' +
      '</div><div class="ft-nokta" aria-hidden="true">' + [0, 1, 2, 3, 4, 5].map(function (n) { return '<i data-ft-n="' + n + '"></i>'; }).join('') + '</div></div>' +
      '<div class="ft-alt-satir"><span class="ft-acd" data-ft-acd>' + W.FO_ACADIA({ mood: 'mutlu', pose: 'selam', size: 110 }) + '</span>' +
        '<div class="ft-konus"><p class="ft-balon" data-ft-balon aria-live="polite"></p>' +
        '<div class="ft-dug"><a class="fo-btn" data-ft-basla href="#/' + (al('sonDers', 'calc1') || 'calc1') + '">' + L.basla + ' →</a><button type="button" class="fo-btn fo-btn-ince" data-ft-izle>▶ ' + L.izle + '</button><button type="button" class="fo-btn fo-btn-ince" data-ft-atla>' + L.atla + ' ⏭</button></div></div></div>' +
      '</div>';
  }
  var zaman = null, raf = 0;
  function kur(kok) {
    var el = kok.querySelector('[data-ft]'); if (!el) return;
    var L = Y[dil()], i = -1;
    function adim(n) {
      clearTimeout(zaman); cancelAnimationFrame(raf); i = n; var a = L.adimlar[n];
      for (var k = 0; k < 6; k++) el.classList.toggle('ft-s' + k, k === n);
      el.classList.toggle('ft-bitti', n === 5);
      el.querySelectorAll('[data-ft-n]').forEach(function (d, k) { d.classList.toggle('on', k === n); d.classList.toggle('gecti', k < n); });
      var b = el.querySelector('[data-ft-balon]'); b.textContent = a[2]; b.classList.remove('ft-yeni'); void b.offsetWidth; b.classList.add('ft-yeni');
      el.querySelector('[data-ft-acd]').innerHTML = W.FO_ACADIA({ mood: a[0], pose: a[1], size: 110 });
      if (n === 2) kaydir();
      if (n < 5) zaman = setTimeout(function () { if (D.body.contains(el)) adim(n + 1); }, SURE[n]); else koy('tanitim', 1);
    }
    /* adım 3: θ 30°→60° kayar, R hesaplanır (v₀ = 20 m/s, g = 9,81) */
    function kaydir() {
      var t0 = performance.now(), ray = el.querySelector('[data-ft-ray]'), aci = el.querySelector('[data-ft-aci]'), R = el.querySelector('[data-ft-R]');
      var say = W.FORMULO_APP ? W.FORMULO_APP.sayi : function (x) { return x.toFixed(1); };
      (function ad(now) { var u = Math.min(1, (now - t0) / 2600), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2, th = 30 + 30 * e;
        ray.style.width = (th / 90 * 100).toFixed(1) + '%'; aci.textContent = Math.round(th) + '°'; R.textContent = say(+(400 * Math.sin(2 * th * Math.PI / 180) / 9.81).toFixed(1));
        if (u < 1) raf = requestAnimationFrame(ad); })(t0);
    }
    el.querySelector('[data-ft-atla]').addEventListener('click', function () { adim(5); });
    el.querySelector('[data-ft-izle]').addEventListener('click', function () { adim(0); });
    if (SAKIN || al('tanitim', 0)) adim(5); else adim(0);
  }
  function dur() { clearTimeout(zaman); cancelAnimationFrame(raf); }
  W.FORMULO_TANITIM = { html: html, kur: kur, dur: dur };
})(window);
