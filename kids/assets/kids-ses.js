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
  var IYI = { en: [/natural.*(sonia|libby|maisie|aria|jenny|ava|emma)/i, /(sonia|libby|aria|jenny|ava|emma).*natural/i, /google uk english female/i, /google us english/i, /samantha|serena|karen|moira|tessa|kate|martha/i, /female/i],
    tr: [/natural.*emel/i, /emel/i, /google t(ü|u)rk/i, /yelda/i, /female|kad(ı|i)n/i] };
  function sesSec(dil) {
    var on = dil === 'tr' ? ['tr-TR', 'tr'] : ['en-GB', 'en-US', 'en'], uygun = sesler.filter(function (v) { var l = (v.lang || '').replace('_', '-'); return on.some(function (o) { return l.indexOf(o) === 0; }); });
    var desen = IYI[dil === 'tr' ? 'tr' : 'en'];
    for (var i = 0; i < desen.length; i++) for (var j = 0; j < uygun.length; j++) if (desen[i].test(uygun[j].name)) return uygun[j];
    for (var k = 0; k < on.length; k++) for (var m = 0; m < uygun.length; m++) if ((uygun[m].lang || '').replace('_', '-').indexOf(on[k]) === 0) return uygun[m];
    return null;
  }

  /* ---------- kayıtlı sesler ---------- */
  var TABAN = /^\/kids(\/|$)/.test(location.pathname) ? '/kids/' : '', LISTE = null, eksik = {}, oynatici = null, bekleyen = null, zaman = [];
  if (W.fetch && location.protocol !== 'file:') W.fetch(TABAN + 'ses/liste.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.sesler) LISTE = j.sesler; }, function () { });
  function anahtar(metin, dil) { return (dil || 'en') + ':' + String(metin).trim().replace(/\s+/g, ' '); }
  function oyn() {
    if (oynatici) return oynatici;
    oynatici = new W.Audio(); oynatici.preload = 'auto';
    return oynatici;
  }
  /* iOS/Safari: ilk dokunuşta oynatıcıyı "uyandır" ki sonraki sesler gecikmeli de çalabilsin */
  function uyandir() {
    W.removeEventListener('pointerdown', uyandir, true);
    try { var a = oyn(); if (!a.src && LISTE) { var ilk = LISTE[Object.keys(LISTE)[0]]; a.src = TABAN + 'ses/' + ilk; } a.muted = true; var p = a.play(); if (p && p.then) p.then(function () { a.pause(); a.muted = false; }, function () { a.muted = false; }); else a.muted = false; } catch (e) { }
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
      a.src = TABAN + 'ses/' + dosya; a.muted = false;
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
        u.rate = ek && ek.hiz ? ek.hiz : dil === 'tr' ? 0.95 : 0.85; u.pitch = 1.1;
        if (ek && ek.sinir) u.onboundary = function (e) { if (e.name === 'word' || e.name === undefined) try { ek.sinir(e.charIndex); } catch (x) { } };
        var son = false, kapat = function () { if (!son) { son = true; bitti(true); } };
        u.onend = kapat; u.onerror = kapat; setTimeout(kapat, 900 + metin.length * 110);
        W.speechSynthesis.speak(u);
      } catch (e) { bitti(false); }
    });
  }
  function sus() { try { if (W.speechSynthesis) W.speechSynthesis.cancel(); } catch (e) { } try { if (oynatici) oynatici.pause(); } catch (e) { } bitir(false); muzik(false); }
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
  var FX = {
    dokun: function () { nota(660, 0, 0.09, 'triangle', 0.1); },
    pat: function () { nota(240, 0, 0.12, 'square', 0.1); nota(520, 0.03, 0.1, 'triangle', 0.12); },
    dogru: function () { nota(660, 0, 0.14, 'triangle'); nota(880, 0.11, 0.2, 'triangle'); },
    yanlis: function () { nota(300, 0, 0.16, 'sine', 0.1); nota(250, 0.1, 0.2, 'sine', 0.1); },
    yildiz: function () { [523, 659, 784, 1047].forEach(function (f, i) { nota(f, i * 0.1, 0.25, 'triangle'); }); },
    cevir: function () { nota(480, 0, 0.07, 'triangle', 0.08); }
  };
  function fx(ad) { if (FX[ad]) FX[ad](); }
  /* şarkı altyapısı: kısa, yumuşak bir ezgi döngüsü (WebAudio, dosya yok). muzik(true) başlatır, muzik(false) durdurur */
  var muzikT = null, EZGI = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1047, 784, 659, 587, 523];
  function muzik(ac_) {
    clearInterval(muzikT); muzikT = null; if (!ac_) return;
    var i = 0, adim = function () { if (!acik) return; nota(EZGI[i % EZGI.length], 0, 0.22, 'triangle', 0.035); if (i % 4 === 0) nota(131, 0, 0.18, 'sine', 0.06); if (i % 4 === 2) nota(196, 0, 0.12, 'sine', 0.03); i++; };
    adim(); muzikT = setInterval(adim, 300);
  }
  function ayar(v) { acik = !!v; try { localStorage.setItem('kids.ses', acik ? '1' : '0'); } catch (e) { } if (!acik) sus(); return acik; }
  W.KIDS_SES = { kayitli: function () { return LISTE ? Object.keys(LISTE).length : 0; }, eksikler: function () { return Object.keys(eksik); }, soyle: soyle, sus: sus, fx: fx, muzik: muzik, ayar: ayar, acikMi: function () { return acik; }, trVar: function () { return !!sesSec('tr'); } };
})(window);
