/* ==========================================================================
   ACADEX KIDS · ses (kids/assets/kids-ses.js), 10.11.2026
   Konuşma iki katmanlı:
     1) Kayıtlı ses (asıl): kids/ses/liste.json içindeki "dil:metin" → MP3. Dosyalar
        kids/ses/uret.js ile ElevenLabs'ten bir kez üretilir (İngilizce ve Türkçe kadın
        öğretmen sesi); stüdyo kaydı gelince aynı adlarla değiştirilir.
     2) Yedek: listede olmayan cümle, tarayıcının en doğal kadın sesiyle okunur
        (Natural / Google / Samantha… öncelikli).
   Efektler ve şarkı altyapısı WebAudio ile üretilir, dosya yok. W.KIDS_SES
   ========================================================================== */
(function (W) {
  'use strict';
  var acik = true, ctx = null, sesler = [];
  try { acik = localStorage.getItem('kids.ses') !== '0'; } catch (e) { }
  function yukle() { try { sesler = W.speechSynthesis ? W.speechSynthesis.getVoices() : []; } catch (e) { sesler = []; } }
  if (W.speechSynthesis) { yukle(); try { W.speechSynthesis.addEventListener('voiceschanged', yukle); } catch (e) { } }
  /* yedek ses: dilde en doğal kadın sesi */
  var IYI = { en: [/natural.*(sonia|libby|maisie|aria|jenny|ava|emma)/i, /(sonia|libby|aria|jenny|ava|emma).*natural/i, /google uk english female/i, /google us english/i, /samantha|serena|karen|moira|tessa|kate|martha/i, /hazel|zira|susan|catherine|linda|heera/i, /female/i],
    tr: [/natural.*emel/i, /emel/i, /google t(ü|u)rk/i, /yelda/i, /female|kad(ı|i)n/i] };
  /* erkek sesler: öğretmen sesi kadın olsun (Windows'ta Türkçe yalnız erkek "Tolga" vardır) */
  var ERKEK = /\b(male|erkek)\b|david|mark|george|james|richard|sean|guy|ryan|tolga|daniel|fred|alex|thomas|oliver|arthur|aaron|ravi|rishi|christopher|eric|roger|brian|andrew|steffan|ahmet|ozan/i;
  function sesSec(dil) {
    var on = dil === 'tr' ? ['tr-TR', 'tr'] : ['en-GB', 'en-US', 'en'], hepsi = sesler.filter(function (v) { var l = (v.lang || '').replace('_', '-'); return on.some(function (o) { return l.indexOf(o) === 0; }); });
    var uygun = hepsi.filter(function (v) { return !ERKEK.test(v.name); });
    /* İngilizce kelime şart: kadın ses yoksa erkekle de okunur. Türkçe yönerge erkek/robot sesle okunmaz (yazı ekranda kalır) */
    if (!uygun.length) { if (dil === 'tr') return null; uygun = hepsi; }
    var desen = IYI[dil === 'tr' ? 'tr' : 'en'];
    for (var i = 0; i < desen.length; i++) for (var j = 0; j < uygun.length; j++) if (desen[i].test(uygun[j].name)) return uygun[j];
    for (var k = 0; k < on.length; k++) for (var m = 0; m < uygun.length; m++) if ((uygun[m].lang || '').replace('_', '-').indexOf(on[k]) === 0) return uygun[m];
    return null;
  }

  /* ---------- kayıtlı sesler ---------- */
  var TABAN = /^\/kids(\/|$)/.test(location.pathname) ? '/kids/' : '', LISTE = null, SURUMLER = {}, eksik = {}, oynatici = null, bekleyen = null, zaman = [];
  if (W.fetch && location.protocol !== 'file:') W.fetch(TABAN + 'ses/liste.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.sesler) { LISTE = j.sesler; SURUMLER = j.ses || {}; } }, function () { });
  /* ses değişince dosya adları aynı kalır; adrese sesin kimliğini ekleyerek tarayıcı ve sw önbelleği yeni sesi alır */
  function adres(dosya) { var d = dosya.split('/')[0], v = SURUMLER[d]; return TABAN + 'ses/' + dosya + (v ? '?v=' + encodeURIComponent(String(v).slice(0, 24)) : ''); }
  function anahtar(metin, dil) { return (dil || 'en') + ':' + String(metin).trim().replace(/\s+/g, ' '); }
  function oyn() {
    if (oynatici) return oynatici;
    oynatici = new W.Audio(); oynatici.preload = 'auto';
    return oynatici;
  }
  /* iOS/Safari: ilk dokunuşta oynatıcıyı "uyandır" ki sonraki sesler gecikmeli de çalabilsin */
  function uyandir() {
    W.removeEventListener('pointerdown', uyandir, true);
    try { var a = oyn(); if (!a.src && LISTE) { var ilk = LISTE[Object.keys(LISTE)[0]]; a.src = adres(ilk); } a.muted = true; var p = a.play(); if (p && p.then) p.then(function () { a.pause(); a.muted = false; }, function () { a.muted = false; }); else a.muted = false; } catch (e) { }
  }
  W.addEventListener('pointerdown', uyandir, true);
  function bitir(sonuc) { zaman.forEach(clearTimeout); zaman = []; if (bekleyen) { var b = bekleyen; bekleyen = null; b(sonuc); } }
  function dosyaCal(dosya, metin, ek, yedek) {
    return new Promise(function (coz) {
      bitir(false); try { if (W.speechSynthesis) W.speechSynthesis.cancel(); } catch (e) { }
      var a = oyn(), bitti = false; bekleyen = function (x) { if (!bitti) { bitti = true; coz(x); } };
      a.onended = function () { bitir(true); };
      a.onerror = function () { var b = bekleyen; bekleyen = null; zaman.forEach(clearTimeout); zaman = []; if (b) yedek().then(b); };
      a.onplaying = function () {
        /* karaoke: kayıtta kelime sınırı yok; harf oranına göre zamanla */
        if (!(ek && ek.sinir) || !isFinite(a.duration)) return;
        var sure = a.duration * 1000 / (a.playbackRate || 1), uz = metin.length, re = /\S+/g, m;
        while ((m = re.exec(metin))) (function (ci) { zaman.push(setTimeout(function () { try { ek.sinir(ci); } catch (x) { } }, sure * ci / uz)); })(m.index);
      };
      zaman.push(setTimeout(function () { bitir(true); }, 15000));
      a.src = adres(dosya); a.muted = false;
      var p = a.play(); if (p && p.catch) p.catch(function () { var b = bekleyen; bekleyen = null; if (b) yedek().then(b); });
    });
  }

  /* metni okur; ses kapalıysa hemen biter. Söz bitince çözülen söz verir.
     ek: {sinir(charIndex)} — kelime sınırı (şarkıda karaoke); {hiz} yalnız yedek seste */
  function soyle(metin, dil, ek) {
    if (!acik) return Promise.resolve(false);
    var k = anahtar(metin, dil), tts = function () { return tarayici(metin, dil, ek); };
    if (LISTE && LISTE[k]) return dosyaCal(LISTE[k], metin, ek, tts);
    if (LISTE) eksik[k] = 1;
    return tts();
  }
  function tarayici(metin, dil, ek) {
    return new Promise(function (bitti) {
      if (!acik || !W.speechSynthesis || !W.SpeechSynthesisUtterance) return bitti(false);
      var v = sesSec(dil || 'en'); if (dil === 'tr' && !v) return bitti(false);   /* Türkçe ses yoksa İngilizce aksanla okutma */
      try {
        bitir(false); if (oynatici) oynatici.pause();
        W.speechSynthesis.cancel();
        var u = new W.SpeechSynthesisUtterance(metin); if (v) u.voice = v; u.lang = v ? v.lang : (dil === 'tr' ? 'tr-TR' : 'en-GB');
        u.rate = ek && ek.hiz ? ek.hiz : dil === 'tr' ? 0.95 : 0.85; u.pitch = ek && ek.perde ? ek.perde : 1.1;
        if (ek && ek.sinir) u.onboundary = function (e) { if (e.name === 'word' || e.name === undefined) try { ek.sinir(e.charIndex); } catch (x) { } };
        var son = false, kapat = function () { if (!son) { son = true; bitti(true); } };
        u.onend = kapat; u.onerror = kapat; setTimeout(kapat, 900 + metin.length * 110);
        W.speechSynthesis.speak(u);
      } catch (e) { bitti(false); }
    });
  }
  function sus() { try { if (W.speechSynthesis) W.speechSynthesis.cancel(); } catch (e) { } try { if (fxCalar) fxCalar.pause(); } catch (e) { } try { if (oynatici) oynatici.pause(); } catch (e) { } bitir(false); muzik(false); }
  function ac() { if (ctx) return ctx; var C = W.AudioContext || W.webkitAudioContext; if (!C) return null; try { ctx = new C(); } catch (e) { ctx = null; } return ctx; }
  function nota(f, t0, sure, tip, g) {
    var c = ac(); if (!c || !acik) return;
    try {
      if (c.state === 'suspended') c.resume();
      var o = c.createOscillator(), k = c.createGain(), t = c.currentTime + t0;
      o.type = tip || 'sine'; o.frequency.setValueAtTime(f, t);
      k.gain.setValueAtTime(0.0001, t); k.gain.exponentialRampToValueAtTime(g || 0.16, t + 0.02); k.gain.exponentialRampToValueAtTime(0.0001, t + sure);
      o.connect(k); k.connect(c.destination); o.start(t); o.stop(t + sure + 0.05);
    } catch (e) { }
  }
  /* kayan nota (miyav, möö…): f0 → f1, isteğe bağlı titreşim (vib Hz) */
  function kay(f0, f1, t0, sure, tip, g, vib) {
    var c = ac(); if (!c || !acik) return;
    try {
      if (c.state === 'suspended') c.resume();
      var o = c.createOscillator(), k = c.createGain(), t = c.currentTime + t0;
      o.type = tip || 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + sure);
      if (vib) { var l = c.createOscillator(), lg = c.createGain(); l.frequency.value = vib; lg.gain.value = f0 * 0.06; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + sure + 0.05); }
      var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.min(4000, f0 * 4);
      k.gain.setValueAtTime(0.0001, t); k.gain.exponentialRampToValueAtTime(g || 0.12, t + Math.min(0.05, sure / 4)); k.gain.exponentialRampToValueAtTime(0.0001, t + sure);
      o.connect(f); f.connect(k); k.connect(c.destination); o.start(t); o.stop(t + sure + 0.05);
    } catch (e) { }
  }
  /* hışırtı (yılan, kükreme, şapırtı): süzülmüş gürültü */
  function hisir(t0, sure, g, ff, tip) {
    var c = ac(); if (!c || !acik) return;
    try {
      var n = Math.floor(c.sampleRate * sure), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      var s = c.createBufferSource(), f = c.createBiquadFilter(), k = c.createGain(), t = c.currentTime + t0;
      s.buffer = b; f.type = tip || 'highpass'; f.frequency.value = ff || 3000;
      k.gain.setValueAtTime(0.0001, t); k.gain.exponentialRampToValueAtTime(g || 0.1, t + 0.03); k.gain.exponentialRampToValueAtTime(0.0001, t + sure);
      s.connect(f); f.connect(k); k.connect(c.destination); s.start(t);
    } catch (e) { }
  }
  /* hayvan sesleri: sentezlenir (kayıt dosyası yok, telif yok); ardından kelime kendini tanıtır */
  var HAYVAN = {
    dog: function () { kay(420, 220, 0, 0.13, 'sawtooth', 0.14); hisir(0, 0.08, 0.05, 900, 'bandpass'); kay(440, 230, 0.22, 0.13, 'sawtooth', 0.14); hisir(0.22, 0.08, 0.05, 900, 'bandpass'); },
    cat: function () { kay(520, 820, 0, 0.22, 'sawtooth', 0.08); kay(820, 420, 0.22, 0.34, 'sawtooth', 0.08); },
    cow: function () { kay(140, 120, 0, 0.9, 'sawtooth', 0.12, 5); },
    sheep: function () { kay(380, 340, 0, 0.6, 'sawtooth', 0.09, 14); },
    goat: function () { kay(440, 380, 0, 0.55, 'sawtooth', 0.09, 16); },
    duck: function () { kay(700, 520, 0, 0.12, 'square', 0.07); kay(720, 520, 0.18, 0.12, 'square', 0.07); },
    bird: function () { [0, 0.14, 0.28].forEach(function (t) { kay(2200, 3400, t, 0.08, 'sine', 0.08); }); },
    chick: function () { [0, 0.16, 0.32].forEach(function (t) { kay(2600, 3000, t, 0.07, 'sine', 0.07); }); },
    hen: function () { [0, 0.12, 0.24].forEach(function (t) { kay(500, 420, t, 0.08, 'square', 0.06); }); kay(700, 900, 0.38, 0.25, 'square', 0.06); },
    pig: function () { kay(260, 200, 0, 0.16, 'square', 0.08, 30); kay(270, 200, 0.24, 0.16, 'square', 0.08, 30); },
    lion: function () { kay(110, 70, 0, 0.9, 'sawtooth', 0.14, 9); hisir(0, 0.8, 0.06, 500, 'lowpass'); },
    tiger: function () { kay(130, 80, 0, 0.7, 'sawtooth', 0.13, 11); hisir(0, 0.6, 0.05, 600, 'lowpass'); },
    bear: function () { kay(100, 70, 0, 0.7, 'sawtooth', 0.13, 7); },
    horse: function () { kay(900, 600, 0, 0.6, 'sawtooth', 0.07, 18); },
    frog: function () { kay(180, 150, 0, 0.12, 'square', 0.09, 40); kay(200, 150, 0.2, 0.14, 'square', 0.09, 40); },
    monkey: function () { [0, 0.2, 0.4].forEach(function (t) { kay(500, 900, t, 0.15, 'triangle', 0.1); }); },
    elephant: function () { kay(300, 700, 0, 0.5, 'sawtooth', 0.1, 6); },
    mouse: function () { kay(3000, 3600, 0, 0.08, 'sine', 0.07); kay(3200, 3800, 0.12, 0.08, 'sine', 0.07); },
    snake: function () { hisir(0, 0.8, 0.08, 4000); },
    owl: function () { kay(380, 340, 0, 0.3, 'sine', 0.13); kay(380, 330, 0.45, 0.45, 'sine', 0.13); },
    bee: function () { kay(220, 240, 0, 0.8, 'sawtooth', 0.05, 25); },
    crocodile: function () { hisir(0, 0.06, 0.2, 1500, 'bandpass'); hisir(0.2, 0.06, 0.2, 1500, 'bandpass'); },
    whale: function () { kay(300, 600, 0, 0.8, 'sine', 0.1); kay(600, 250, 0.8, 0.8, 'sine', 0.08); },
    dolphin: function () { [0, 0.08, 0.16, 0.24].forEach(function (t) { kay(3000, 4200, t, 0.05, 'sine', 0.07); }); },
    seal: function () { kay(500, 350, 0, 0.14, 'sawtooth', 0.1); kay(520, 350, 0.22, 0.14, 'sawtooth', 0.1); },
    rabbit: function () { kay(1800, 2400, 0, 0.06, 'sine', 0.06); kay(1900, 2500, 0.14, 0.06, 'sine', 0.06); },
    walrus: function () { kay(160, 110, 0, 0.5, 'sawtooth', 0.11, 8); }
  };
  /* çizgi film efekti: kayıtlı dosya (liste.json "fx:<id>") varsa onu, yoksa sentezi çalar; bitince çözülür */
  var fxCalar = null;
  function hayvan(id) {
    return new Promise(function (coz) {
      if (!acik) return coz(false);
      var d = LISTE && LISTE['fx:' + id], son = false, bit = function (x) { if (!son) { son = true; coz(x); } };
      if (d) {
        try {
          fxCalar = fxCalar || new W.Audio(); fxCalar.pause(); fxCalar.src = adres(d); fxCalar.volume = 0.9;
          fxCalar.onended = function () { bit(true); }; fxCalar.onerror = function () { if (HAYVAN[id]) HAYVAN[id](); setTimeout(function () { bit(true); }, 900); };
          var p = fxCalar.play(); if (p && p.catch) p.catch(function () { fxCalar.onerror(); });
          return setTimeout(function () { bit(true); }, 4500);
        } catch (e) { }
      }
      if (HAYVAN[id]) { HAYVAN[id](); return setTimeout(function () { bit(true); }, 950); }
      bit(false);
    });
  }
  var FX = {
    hayvan: function (id) { hayvan(id); },
    dokun: function () { nota(660, 0, 0.09, 'triangle', 0.1); },
    pat: function () { nota(240, 0, 0.12, 'square', 0.1); nota(520, 0.03, 0.1, 'triangle', 0.12); },
    dogru: function () { nota(660, 0, 0.14, 'triangle'); nota(880, 0.11, 0.2, 'triangle'); },
    yanlis: function () { nota(300, 0, 0.16, 'sine', 0.1); nota(250, 0.1, 0.2, 'sine', 0.1); },
    yildiz: function () { [523, 659, 784, 1047].forEach(function (f, i) { nota(f, i * 0.1, 0.25, 'triangle'); }); },
    cevir: function () { nota(480, 0, 0.07, 'triangle', 0.08); },
    /* seri: her doğru cevapta bir nota yukarı (do-re-mi…) */
    seri: function (n) { var g = [0, 2, 4, 5, 7, 9, 11, 12][Math.min(7, Math.max(0, (n || 1) - 1))]; nota(523.25 * Math.pow(2, g / 12), 0, 0.18, 'triangle', 0.12); nota(523.25 * Math.pow(2, (g + 7) / 12), 0.06, 0.16, 'sine', 0.06); },
    duduk: function () { nota(587, 0, 0.35, 'square', 0.05); nota(740, 0, 0.35, 'square', 0.04); nota(587, 0.42, 0.25, 'square', 0.05); }
  };
  function fx(ad, x) { if (FX[ad]) FX[ad](x); }
  /* şarkı altyapısı: kısa, yumuşak bir ezgi döngüsü (WebAudio, dosya yok). muzik(true) başlatır, muzik(false) durdurur */
  var muzikT = null, EZGI = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1047, 784, 659, 587, 523];
  function muzik(ac_) {
    clearInterval(muzikT); muzikT = null; if (!ac_) return;
    var i = 0, adim = function () { if (!acik) return; nota(EZGI[i % EZGI.length], 0, 0.22, 'triangle', 0.035); if (i % 4 === 0) nota(131, 0, 0.18, 'sine', 0.06); if (i % 4 === 2) nota(196, 0, 0.12, 'sine', 0.03); i++; };
    adim(); muzikT = setInterval(adim, 300);
  }
  /* ninni: uyku vakti için çok yavaş, yumuşak bir ezgi (WebAudio). ninni(true) başlatır, ninni(false) durdurur */
  var ninniT = null, NINNI = [392, 330, 330, 349, 294, 294, 262, 294, 330, 349, 392, 392, 392, 330, 330, 349, 294, 294, 262, 330, 392, 392, 262, 0];
  function ninni(ac_) {
    clearInterval(ninniT); ninniT = null; if (!ac_) return;
    var i = 0, adim = function () { if (!acik) return; var f = NINNI[i % NINNI.length]; if (f) { nota(f, 0, 1.1, 'sine', 0.045); if (i % 3 === 0) nota(f / 2, 0, 1.6, 'sine', 0.03); } i++; };
    adim(); ninniT = setInterval(adim, 850);
  }
  function ayar(v) { acik = !!v; try { localStorage.setItem('kids.ses', acik ? '1' : '0'); } catch (e) { } if (!acik) sus(); return acik; }
  /* parça parça söyle (karışık sorular: "Find" + "three" + "red" + "cars"): bütün cümle kayıtlıysa onu,
     değilse kayıtlı parçaları art arda çalar; böylece sınırsız birleşim de öğretmen sesiyle duyulur */
  function kayitliMi(metin, dil) { return !!(LISTE && LISTE[anahtar(metin, dil)]); }
  function dizi(parcalar, dil) {
    var tam = parcalar.join(' ').replace(/ ([!?.,])/g, '$1');
    if (kayitliMi(tam, dil) || !LISTE || !parcalar.every(function (x) { return kayitliMi(x, dil); })) return soyle(tam, dil);
    var i = 0; return (function sira() { if (i >= parcalar.length || !acik) return Promise.resolve(true); return soyle(parcalar[i++], dil).then(function (ok) { return ok === false ? false : sira(); }); })();
  }
  W.KIDS_SES = { ninni: ninni, hayvan: hayvan, kayitliMi: kayitliMi, dizi: dizi, surumler: function () { return SURUMLER; }, kayitli: function () { return LISTE ? Object.keys(LISTE).length : 0; }, eksikler: function () { return Object.keys(eksik); }, soyle: soyle, sus: sus, fx: fx, muzik: muzik, ayar: ayar, acikMi: function () { return acik; }, trVar: function () { return !!sesSec('tr'); } };
})(window);
