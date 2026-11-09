/* ==========================================================================
   ACADEX KIDS · ses (kids/assets/kids-ses.js), 10.11.2026
   Tasarım sürümünde konuşma tarayıcının kendi sesiyle (speechSynthesis) okunur;
   satış sürümünde her kelime için stüdyo kaydı (gerçek seslendirmen) konacak:
   KIDS_SES.soyle() önce assets/ses/<dil>/<anahtar>.mp3 dosyasına bakacak şekilde
   genişletilir. Efektler WebAudio ile üretilir, dosya yok. W.KIDS_SES
   ========================================================================== */
(function (W) {
  'use strict';
  var acik = true, ctx = null, sesler = [];
  try { acik = localStorage.getItem('kids.ses') !== '0'; } catch (e) { }
  function yukle() { try { sesler = W.speechSynthesis ? W.speechSynthesis.getVoices() : []; } catch (e) { sesler = []; } }
  if (W.speechSynthesis) { yukle(); try { W.speechSynthesis.addEventListener('voiceschanged', yukle); } catch (e) { } }
  function sesSec(dil) {
    var on = dil === 'tr' ? ['tr-TR', 'tr'] : ['en-GB', 'en-US', 'en'];
    for (var i = 0; i < on.length; i++) for (var j = 0; j < sesler.length; j++) if ((sesler[j].lang || '').replace('_', '-').indexOf(on[i]) === 0) return sesler[j];
    return null;
  }
  /* metni okur; ses yoksa ya da kapalıysa hemen biter. Söz bitince çözülen söz verir. */
  function soyle(metin, dil) {
    return new Promise(function (bitti) {
      if (!acik || !W.speechSynthesis || !W.SpeechSynthesisUtterance) return bitti(false);
      var v = sesSec(dil || 'en'); if (dil === 'tr' && !v) return bitti(false);   /* Türkçe ses yoksa İngilizce aksanla okutma */
      try {
        W.speechSynthesis.cancel();
        var u = new W.SpeechSynthesisUtterance(metin); if (v) u.voice = v; u.lang = v ? v.lang : (dil === 'tr' ? 'tr-TR' : 'en-GB');
        u.rate = dil === 'tr' ? 0.95 : 0.82; u.pitch = 1.25;
        var son = false, kapat = function () { if (!son) { son = true; bitti(true); } };
        u.onend = kapat; u.onerror = kapat; setTimeout(kapat, 900 + metin.length * 110);
        W.speechSynthesis.speak(u);
      } catch (e) { bitti(false); }
    });
  }
  function sus() { try { if (W.speechSynthesis) W.speechSynthesis.cancel(); } catch (e) { } }
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
  function ayar(v) { acik = !!v; try { localStorage.setItem('kids.ses', acik ? '1' : '0'); } catch (e) { } if (!acik) sus(); return acik; }
  W.KIDS_SES = { soyle: soyle, sus: sus, fx: fx, ayar: ayar, acikMi: function () { return acik; }, trVar: function () { return !!sesSec('tr'); } };
})(window);
