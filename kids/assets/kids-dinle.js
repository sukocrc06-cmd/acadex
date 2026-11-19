/* ==========================================================================
   ACADEX KIDS · SESLİ CEVAP VE SESLİ KOMUT (kids/assets/kids-dinle.js + kids-dinle.css), 20.11.2026
   Çocuk İngilizce kelimeyi söyler, Acadia anlar ve "Aferin!" der; Türkçe komutla gezinir
   ("hayvanlara git", "kitaplık", "geri", "tekrar söyle").

   KARMA TANIMA (her cihazda çalışsın):
     1) Cihazın kendi tanıması (SpeechRecognition: Chrome, Edge, Android, iPhone/iPad Safari)
     2) Yoksa ya da hata verirse (Firefox, bazı tabletler, uygulama içi tarayıcılar):
        kısa ses parçası (yalnız konuşulan kısım, en çok ~5 sn) Supabase edge function
        kids-ses-tanima → Groq Whisper; yazıya çevrilir, ses hiçbir yerde saklanmaz.
   ÇOCUK TELAFFUZU: esnek eşleştirme (eslesir): "kar" = car, "blu" = blue, "tri" = three,
     "3" = three. Türkçe kulağa göre sadeleştirilmiş ses anahtarı + küçük yazım farkı payı.
     Birden çok seçenekli soruda (hangisi?) daha katı: en iyi aday tek ve net olmalı.
   İZİN: mikrofon yalnız VELİ açınca kullanılır (büyükler kapısı: toplama sorusu). Durum
     localStorage 'kids.mik': 'acik' | 'kapali' | yok (= henüz sorulmadı). Veli köşesinden kapatılır.
   W.KIDS_DINLE = { destek, izin, izinVer, izinSor, hazir, dinle, tekrarla, eslesir, enIyi,
                    komut, komutDugmesi, durdur, cumleler }
   ========================================================================== */
(function (W) {
  'use strict';
  var D = W.document, SES = function () { return W.KIDS_SES; };
  var SR = W.SpeechRecognition || W.webkitSpeechRecognition;
  var SUNUCU = 'https://yrcdvcsowblzmkpbmkut.supabase.co/functions/v1/kids-ses-tanima', ANAHTAR = 'sb_publishable_W_DZnHPY-I51nioiWOTJmw_FCnyFjxm';
  var cihazBozuk = false;   /* bu oturumda cihaz tanıması izin/ağ hatası verdiyse sunucuya geç */
  var lsAl = function (k) { try { return W.localStorage.getItem(k); } catch (e) { return null; } };
  var lsKoy = function (k, v) { try { if (v == null) W.localStorage.removeItem(k); else W.localStorage.setItem(k, v); } catch (e) { } };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ======================= eşleştirme (saf; tests/kids-dinle.js) ======================= */
  var SAYI = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  function duz(s, dil) {
    s = String(s || '');
    s = dil === 'tr' ? s.toLocaleLowerCase('tr') : s.toLowerCase();
    s = s.replace(/[’'`´]/g, '').replace(/[^0-9a-zçğıöşüâîû\s-]/g, ' ').replace(/-/g, ' ');
    if (dil !== 'tr') s = s.replace(/\b(\d{1,2})\b/g, function (m, n) { return SAYI[+n] || m; });
    return s.replace(/\s+/g, ' ').trim();
  }
  /* Türk çocuğunun kulağıyla İngilizce: yazıyı sese yakın, sade bir anahtara çevir */
  function fon(s) {
    s = String(s || '').toLowerCase().replace(/\s+/g, '');
    /* C: "ç / ch / j / yumuşak g" sesi (çiz = cheese, orınç = orange) */
    s = s.replace(/ç/g, 'C').replace(/ş/g, 'sh').replace(/ı/g, 'i').replace(/ğ/g, '').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/[âîû]/g, function (c) { return { 'â': 'a', 'î': 'i', 'û': 'u' }[c]; });
    s = s.replace(/tch/g, 'c').replace(/ph/g, 'f').replace(/gh/g, '').replace(/ck/g, 'k').replace(/qu/g, 'kv').replace(/q/g, 'k').replace(/x/g, 'ks')
      .replace(/wh/g, 'v').replace(/w/g, 'v').replace(/th/g, 't').replace(/sh/g, 's').replace(/ch/g, 'C').replace(/j/g, 'C').replace(/dge/g, 'C').replace(/g(?=[eiy])/g, 'C')
      .replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/z/g, 's')
      .replace(/ee|ea|ie/g, 'i').replace(/oo|ou/g, 'u').replace(/ai|ay|ei|ey/g, 'e').replace(/oa/g, 'o').replace(/ow$/g, 'o')
      .replace(/y$/g, 'i').replace(/y(?=[^aeiou])/g, 'i');
    if (s.length > 3) s = s.replace(/e$/, '');
    s = s.replace(/h(?![aeiou])/g, '').replace(/(.)\1+/g, '$1');
    return s;
  }
  var iskelet = function (k) { return k.replace(/[aeiou]/g, ''); };
  /* kısa kelimede ötümlü/ötümsüz çift (d/t, b/p, g/k, v/f) aynı sayılır: "ret" = red */
  var yumusak = function (k) { return k.replace(/d/g, 't').replace(/b/g, 'p').replace(/g/g, 'k').replace(/v/g, 'f'); };
  function lev(a, b) {
    if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
    var o = [], i, j; for (j = 0; j <= b.length; j++) o[j] = j;
    for (i = 1; i <= a.length; i++) { var p = o[0]; o[0] = i; for (j = 1; j <= b.length; j++) { var t = o[j]; o[j] = Math.min(o[j] + 1, o[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } }
    return o[b.length];
  }
  /* duyulan metinde beklenen kelime (ya da kelime grubu) var mı? 0..1 puan */
  function puan(duyulan, beklenen, dil) {
    var h = duz(duyulan, dil), t = duz(beklenen, dil); if (!h || !t) return 0;
    if ((' ' + h + ' ').indexOf(' ' + t + ' ') >= 0) return 1;
    var hs = h.split(' '), n = t.split(' ').length, kt = fon(t), en = 0;
    for (var g = Math.max(1, n - 1); g <= n + 1; g++) {
      for (var i = 0; i + g <= hs.length; i++) {
        var c = hs.slice(i, i + g).join(''), kc = fon(c);
        if (c === t.replace(/ /g, '')) return 1;
        if (kc === kt) { en = Math.max(en, 0.95); continue; }
        var d = lev(kc, kt), ik = iskelet(kc), it = iskelet(kt);
        if (kt.length <= 3) {
          /* kısa kelime (car, red, cat): ünsüz iskeleti aynı olmalı, yalnız ünlü / ötümlülük farkı olur
             (cat ≠ car, bed ≠ red, big ≠ pig ama kar = car, ret = red) */
          if (it.length && yumusak(ik) === yumusak(it) && kc.charAt(0) === kt.charAt(0) || (it.length && ik === it)) en = Math.max(en, 0.8);
        } else if (d <= (kt.length <= 6 ? 1 : 2)) en = Math.max(en, 0.85 - d * 0.05);
        else if (it.length >= 2 && ik === it) en = Math.max(en, 0.72);
      }
    }
    return en;
  }
  function eslesir(duyulan, beklenen, dil) { var p = puan(duyulan, beklenen, dil); return { ok: p >= 0.7, puan: p }; }
  /* çok seçenekli: hangi seçenek söylendi? en iyi tek ve net değilse null */
  function enIyi(duyulanlar, secenekler, dil) {
    var L = secenekler.map(function (s) { return { s: s, p: Math.max.apply(null, [].concat(duyulanlar).map(function (d) { return puan(d, s, dil); })) }; }).sort(function (a, b) { return b.p - a.p; });
    if (!L.length || L[0].p < 0.8) return null;
    if (L[1] && L[1].p >= L[0].p - 0.05 && L[0].p < 1) return null;
    return L[0].s;
  }

  /* ======================= Türkçe komutlar ======================= */
  var KOMUT = [
    ['sesKapat', /\b(sus|sessiz|sesi kapat)/],
    ['sesAc', /\b(sesi a[çc])/],
    ['geri', /\b(geri|haritaya|harita|ana sayfa|anasayfa|eve d[öo]n|kapat|[çc][ıi]k)/],
    ['tekrar', /\b(tekrar|bir daha|yine|yeniden|dinle)/],
    ['ileri', /\b(sonraki|ileri|devam|ge[çc])/],
    ['kitap', /\b(kitap|kitapl[ıi]k|masal|hikaye|hikâye)/],
    ['sahnekur', /\b(resim|boya|[çc]iz)/],
    ['sozluk', /\b(kelimelerim|kelime)/],
    ['dolap', /\b(dolab|dolap|giysi|k[ıi]yafet)/],
    ['album', /\b(alb[üu]m|[çc][ıi]kartma)/],
    ['daha', /\b(daha fazla|daha [çc]ok|di[ğg]er oyun)/],
    ['oyna', /\b(oyna|ba[şs]la|hadi)/]
  ];
  /* konular: Türkçe ad (ilk 4-5 harf kökü, ek almış hâlleri de tutar: "hayvanlara") ve İngilizce ad */
  function komut(metin, konular) {
    var h = duz(metin, 'tr'); if (!h) return null;
    var k = (konular || []).map(function (x) { var tr = duz(x.tr, 'tr'), kok = tr.slice(0, Math.max(4, Math.min(6, tr.length - 1))); return { id: x.id, kok: kok, en: duz(x.en, 'en') }; });
    for (var i = 0; i < k.length; i++) if (h.indexOf(k[i].kok) >= 0 || (' ' + duz(metin, 'en') + ' ').indexOf(' ' + k[i].en + ' ') >= 0) return { tur: 'konu', id: k[i].id, metin: h };
    for (var j = 0; j < KOMUT.length; j++) if (KOMUT[j][1].test(h)) return { tur: KOMUT[j][0], metin: h };
    return null;
  }

  /* ======================= izin ======================= */
  function destek() {
    var n = W.navigator || {};
    return { cihaz: !!SR && !cihazBozuk, kayit: !!(n.mediaDevices && n.mediaDevices.getUserMedia && W.MediaRecorder), sunucu: !!SUNUCU };
  }
  function izin() { var v = lsAl('kids.mik'); return v === 'acik' || v === 'kapali' ? v : 'sor'; }
  function izinVer(v) { lsKoy('kids.mik', v === 'acik' ? 'acik' : v === 'kapali' ? 'kapali' : null); D.dispatchEvent(new CustomEvent('kids-mik', { detail: izin() })); }
  function hazir() { var d = destek(); return izin() === 'acik' && (d.cihaz || (d.kayit && d.sunucu)); }
  /* büyükler kapısı: veli onaylamadan mikrofon açılmaz */
  function izinSor() {
    return new Promise(function (coz) {
      var d = destek();
      if (!d.cihaz && !d.kayit) return coz(false);
      var a = 2 + Math.floor(Math.random() * 6), b = 3 + Math.floor(Math.random() * 5);
      var o = D.createElement('div'); o.className = 'ka-ort kd-izin';
      o.innerHTML = '<div class="ka-pen" role="dialog" aria-modal="true" aria-labelledby="kd-izin-b" tabindex="-1"><header class="ka-pen-bas"><h2 id="kd-izin-b">Acadia seni duysun mu?</h2><button type="button" class="ka-yuvarlak" data-kdh aria-label="Kapat">×</button></header>' +
        '<p class="ka-pen-alt"><b>Büyükler için:</b> Çocuğunuz kelimeyi söylediğinde Acadia anlasın ve "Aferin!" desin diye mikrofon kullanılır. Ses <b>kaydedilmez</b>: ' +
        'cihazın kendi ses tanıması (Google / Apple) ya da Acadex sunucusu üzerinden yalnız yazıya çevrilir ve hemen silinir. Bu ayarı Veli köşesi → Ayarlar\'dan kapatabilirsiniz.</p>' +
        '<form data-kdf><p class="ka-pen-alt">Açmak için işlemi çözün: <b>' + a + ' + ' + b + ' = ?</b></p><input class="ka-girdi" inputmode="numeric" maxlength="3" aria-label="Cevap" autocomplete="off"><p class="ka-uyari" aria-live="polite"></p>' +
        '<div class="ka-izle-alt"><button type="button" class="ka-orta" data-kdh>Şimdi değil</button><button type="submit" class="ka-buyuk">Mikrofonu aç</button></div></form></div>';
      D.body.appendChild(o);
      var bit = function (v) { o.remove(); coz(v); };
      o.querySelectorAll('[data-kdh]').forEach(function (x) { x.addEventListener('click', function () { izinVer('kapali'); bit(false); }); });
      o.querySelector('[data-kdf]').addEventListener('submit', function (e) {
        e.preventDefault();
        if (+o.querySelector('input').value === a + b) { izinVer('acik'); bit(true); }
        else o.querySelector('.ka-uyari').textContent = 'Olmadı, yeniden deneyin.';
      });
      setTimeout(function () { var i = o.querySelector('input'); if (i) i.focus(); }, 40);
    });
  }

  /* ======================= motor 1: cihaz tanıması ======================= */
  var aktif = null;   /* { dur() } */
  function cihazDinle(o) {
    return new Promise(function (coz) {
      var r, bitti = false, duyulan = [], son = { durum: 'sessiz' };
      try { r = new SR(); } catch (e) { cihazBozuk = true; return coz({ durum: 'motor' }); }
      r.lang = o.dil === 'tr' ? 'tr-TR' : 'en-US'; r.interimResults = true; r.maxAlternatives = 5; r.continuous = false;
      var bitir = function (x) { if (bitti) return; bitti = true; clearTimeout(t); try { r.abort(); } catch (e) { } aktif = null; coz(x); };
      var t = setTimeout(function () { bitir(duyulan.length ? sonuc(duyulan, o, 'cihaz') : { durum: 'sessiz', yol: 'cihaz' }); }, o.sure || 5000);
      r.onresult = function (e) {
        for (var i = e.resultIndex; i < e.results.length; i++) for (var j = 0; j < e.results[i].length; j++) if (e.results[i][j].transcript) duyulan.push(e.results[i][j].transcript);
        son = sonuc(duyulan, o, 'cihaz');
        if (son.durum === 'tamam') bitir(son);   /* doğruyu duyar duymaz bitir (ara sonuç da olur) */
      };
      r.onerror = function (e) {
        var k = e && e.error;
        if (k === 'not-allowed' || k === 'service-not-allowed' || k === 'network' || k === 'audio-capture' || k === 'language-not-supported') { cihazBozuk = true; return bitir({ durum: 'motor', hata: k }); }
        if (k === 'no-speech') return bitir({ durum: 'sessiz', yol: 'cihaz' });
      };
      r.onend = function () { bitir(duyulan.length ? sonuc(duyulan, o, 'cihaz') : { durum: 'sessiz', yol: 'cihaz' }); };
      aktif = { dur: function () { bitir({ durum: 'iptal' }); } };
      try { r.start(); } catch (e) { cihazBozuk = true; bitir({ durum: 'motor' }); }
    });
  }

  /* ======================= motor 2: kısa kayıt → sunucu (Whisper) ======================= */
  var akis = null, akisT = 0;
  function mikAl() {
    clearTimeout(akisT);
    if (akis && akis.active) return Promise.resolve(akis);
    return W.navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(function (s) { akis = s; return s; });
  }
  /* 20 sn kullanılmayan mikrofonu kapat (tarayıcıdaki kırmızı nokta sönsün) */
  function mikBirak(hemen) { clearTimeout(akisT); akisT = setTimeout(function () { if (akis) akis.getTracks().forEach(function (t) { t.stop(); }); akis = null; }, hemen ? 0 : 20000); }
  function turSec() { var L = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/aac']; for (var i = 0; i < L.length; i++) if (W.MediaRecorder.isTypeSupported && W.MediaRecorder.isTypeSupported(L[i])) return L[i]; return ''; }
  function sunucuDinle(o) {
    return mikAl().then(function (s) {
      return new Promise(function (coz) {
        var tur = turSec(), kayit, parca = [], bitti = false, konustu = false, sessizBas = 0, basla = Date.now();
        try { kayit = tur ? new W.MediaRecorder(s, { mimeType: tur }) : new W.MediaRecorder(s); } catch (e) { return coz({ durum: 'motor' }); }
        /* ses etkinliği: konuşma başlayınca kaydı sürdür, 0,8 sn sessizlikte bitir */
        var AC = W.AudioContext || W.webkitAudioContext, ac = null, an = null, buf = null, raf = 0;
        try { ac = new AC(); var kaynak = ac.createMediaStreamSource(s); an = ac.createAnalyser(); an.fftSize = 1024; kaynak.connect(an); buf = new Float32Array(an.fftSize); } catch (e) { ac = null; }
        var bitir = function () { if (bitti) return; bitti = true; cancelAnimationFrame(raf); clearTimeout(t); try { if (kayit.state !== 'inactive') kayit.stop(); } catch (e) { } };
        var t = setTimeout(bitir, o.sure || 5000);
        function bak() {
          if (bitti || !an) return;
          an.getFloatTimeDomainData(buf); var e = 0; for (var i = 0; i < buf.length; i++) e += buf[i] * buf[i]; e = Math.sqrt(e / buf.length);
          var simdi = Date.now();
          if (e > 0.025) { konustu = true; sessizBas = 0; if (o.seviye) o.seviye(Math.min(1, e * 8)); }
          else if (konustu) { if (!sessizBas) sessizBas = simdi; else if (simdi - sessizBas > 800) return bitir(); }
          if (!konustu && simdi - basla > Math.min(o.sure || 5000, 4000)) return bitir();
          raf = requestAnimationFrame(bak);
        }
        kayit.ondataavailable = function (e) { if (e.data && e.data.size) parca.push(e.data); };
        kayit.onstop = function () {
          aktif = null; if (ac) try { ac.close(); } catch (e) { } mikBirak();
          if (an && !konustu) return coz({ durum: 'sessiz', yol: 'sunucu' });
          var blob = new Blob(parca, { type: kayit.mimeType || tur || 'audio/webm' });
          if (!blob.size) return coz({ durum: 'sessiz', yol: 'sunucu' });
          if (o.kayitUrl) try { o.kayitUrl(URL.createObjectURL(blob)); } catch (e) { }
          var q = '?dil=' + (o.dil === 'tr' ? 'tr' : 'en') + '&ipucu=' + encodeURIComponent((o.kelimeler || []).slice(0, 12).join(', ').slice(0, 200));
          var ctrl = W.AbortController ? new AbortController() : null, zt = setTimeout(function () { if (ctrl) ctrl.abort(); }, 9000);
          fetch(SUNUCU + q, { method: 'POST', headers: { 'Content-Type': blob.type.split(';')[0] || 'audio/webm', apikey: ANAHTAR, Authorization: 'Bearer ' + ANAHTAR }, body: blob, signal: ctrl ? ctrl.signal : undefined })
            .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
            .then(function (j) { clearTimeout(zt); var m = String((j && j.metin) || '').trim(); coz(m ? sonuc([m], o, 'sunucu') : { durum: 'sessiz', yol: 'sunucu' }); })
            .catch(function (e) { clearTimeout(zt); coz({ durum: 'hata', yol: 'sunucu', hata: String(e) }); });
        };
        aktif = { dur: function () { bitti = true; cancelAnimationFrame(raf); clearTimeout(t); kayit.onstop = function () { aktif = null; mikBirak(); coz({ durum: 'iptal' }); }; try { kayit.stop(); } catch (e) { coz({ durum: 'iptal' }); } } };
        try { kayit.start(); } catch (e) { return coz({ durum: 'motor' }); }
        raf = requestAnimationFrame(bak);
      });
    }, function (e) { return { durum: 'izin', hata: String(e && e.name || e) }; });
  }

  function sonuc(duyulan, o, yol) {
    var ilk = duyulan[duyulan.length - 1] || duyulan[0] || '';
    if (o.komut) return { durum: 'metin', metin: duyulan[0] || ilk, hepsi: duyulan, yol: yol };
    var L = o.kelimeler || [];
    if (L.length > 1) { var s = enIyi(duyulan, L, o.dil); return s ? { durum: 'tamam', kelime: s, metin: ilk, hepsi: duyulan, yol: yol } : { durum: 'yanlis', metin: ilk, hepsi: duyulan, yol: yol }; }
    var p = Math.max.apply(null, duyulan.map(function (d) { return puan(d, L[0], o.dil); }).concat(0));
    return p >= 0.7 ? { durum: 'tamam', kelime: L[0], metin: ilk, puan: p, yol: yol } : { durum: 'yanlis', metin: ilk, puan: p, hepsi: duyulan, yol: yol };
  }

  /* dinle({ kelimeler:[…], dil:'en'|'tr', sure, komut, seviye(0..1), kayitUrl(url) }) → Promise<sonuç>
     sonuç.durum: tamam | yanlis | sessiz | metin (komut) | izin | hata | motor | iptal | kapali */
  function dinle(o) {
    o = o || {};
    if (izin() !== 'acik') return Promise.resolve({ durum: 'kapali' });
    durdur(); if (SES() && SES().sus) SES().sus();
    var d = destek();
    var sunucuyla = function () { return d.kayit && d.sunucu ? sunucuDinle(o) : Promise.resolve({ durum: 'motor' }); };
    if (d.cihaz) return cihazDinle(o).then(function (x) { return x.durum === 'motor' ? sunucuyla() : x; });
    return sunucuyla();
  }
  function durdur() { if (aktif) aktif.dur(); aktif = null; }

  /* ======================= "Hadi sen de söyle!" akışı (kitap, İzle, Söyle durağı) =======================
     o: { en, kok (gösterge eklenecek kap), deneme (vars. 2), soyle(): kelimeyi tekrar söyletir }
     dönüş: 'tamam' | 'denedi' | 'sessiz' | 'yok' (mikrofon kapalı/desteksiz) */
  var OVGU = ['Aferin!', 'Süpersin!', 'Harika söyledin!', 'Çok güzel!'];
  var cumleler = function () { return OVGU.concat(['Bir daha dene!', 'Çok güzel deneme!', 'Seni duyamadım. Bir daha söyler misin?', 'Hadi sen de söyle!', 'Anlayamadım. Bir daha söyler misin?', 'Önce haritaya dönelim.', 'Mikrofon açılamadı.']); };
  function gosterge(kok, durum, yazi) {
    if (!kok) return;
    var g = kok.querySelector('.kd-gos');
    if (!g) { g = D.createElement('div'); g.className = 'kd-gos'; g.setAttribute('aria-live', 'polite'); kok.appendChild(g); }
    g.className = 'kd-gos kd-' + durum; g.hidden = durum === 'gizli';
    g.innerHTML = '<span class="kd-mik" aria-hidden="true"><i></i>' + (W.KIDS_CIZ ? W.KIDS_CIZ.simge('mikrofon') : '') + '</span><b>' + esc(yazi || '') + '</b>';
    return g;
  }
  function tekrarla(o) {
    if (!hazir()) return Promise.resolve('yok');
    var kac = o.deneme || 2, n = 0, S = SES();
    function tur() {
      n++;
      gosterge(o.kok, 'dinliyor', 'Seni dinliyorum…');
      return dinle({ kelimeler: [o.en], dil: 'en', sure: 5000, seviye: function (v) { var g = o.kok && o.kok.querySelector('.kd-gos'); if (g) g.style.setProperty('--sv', v.toFixed(2)); } }).then(function (r) {
        if (r.durum === 'tamam') { gosterge(o.kok, 'tamam', '“' + o.en + '” ✓'); if (S) { S.fx('dogru'); return S.soyle(OVGU[Math.floor(Math.random() * OVGU.length)], 'tr').then(function () { return 'tamam'; }); } return 'tamam'; }
        if (r.durum === 'kapali' || r.durum === 'motor' || r.durum === 'izin' || r.durum === 'hata') { gosterge(o.kok, 'gizli'); return r.durum === 'izin' ? (S ? S.soyle('Mikrofon açılamadı.', 'tr') : Promise.resolve()).then(function () { return 'yok'; }) : 'yok'; }
        if (r.durum === 'iptal') { gosterge(o.kok, 'gizli'); return 'iptal'; }
        if (n >= kac) { gosterge(o.kok, 'gizli'); return (S ? S.soyle('Çok güzel deneme!', 'tr') : Promise.resolve()).then(function () { if (o.soyle) return o.soyle(); }).then(function () { return r.durum === 'sessiz' ? 'sessiz' : 'denedi'; }); }
        gosterge(o.kok, 'yeniden', r.durum === 'sessiz' ? 'Duyamadım' : (r.metin ? '“' + r.metin + '”?' : ''));
        if (S) S.fx(r.durum === 'sessiz' ? 'dokun' : 'yanlis');
        return (S ? S.soyle(r.durum === 'sessiz' ? 'Seni duyamadım. Bir daha söyler misin?' : 'Bir daha dene!', 'tr') : Promise.resolve()).then(function () { return o.soyle ? o.soyle() : null; }).then(tur);
      });
    }
    return tur();
  }

  /* ======================= sesli komut düğmesi (Kids'in her ekranında, sağ altta) ======================= */
  function komutDugmesi(o) {
    /* o: { kok(): uygulama kökü, konular(): [{id,tr,en}], yap(komut), secenekler(): [{el, en}] }
       Ekranda oyun seçenekleri varsa (Hangisi blue?) düğme İngilizce cevabı dinler ve o seçeneğe basar;
       yoksa Türkçe komut dinler. */
    if (D.querySelector('.kd-komut')) return;
    var d = destek(); if (!d.cihaz && !d.kayit) return;
    var b = D.createElement('button'); b.type = 'button'; b.className = 'kd-komut'; b.setAttribute('aria-label', 'Sesli komut: konuş, Acadia yapsın');
    b.innerHTML = '<span class="kd-mik" aria-hidden="true"><i></i>' + (W.KIDS_CIZ ? W.KIDS_CIZ.simge('mikrofon') : '🎤') + '</span><b class="kd-komut-y" aria-live="polite"></b>';
    D.body.appendChild(b);
    var yazi = b.querySelector('.kd-komut-y'), t = 0;
    function goster(s) { clearTimeout(t); yazi.textContent = s || ''; b.classList.toggle('kd-yazili', !!s); if (s) t = setTimeout(function () { b.classList.remove('kd-yazili'); }, 2600); }
    function gorunur() { var k = o.kok && o.kok(); b.hidden = !(k && k.isConnected && k.getClientRects().length && k.dataset.gorunum && k.dataset.gorunum !== 'giris'); }
    gorunur(); if (W.MutationObserver) { var k0 = o.kok && o.kok(); if (k0) new MutationObserver(gorunur).observe(k0, { attributes: true, attributeFilter: ['data-gorunum'] }); }
    W.addEventListener('hashchange', function () { setTimeout(gorunur, 0); });
    b.addEventListener('click', function () {
      if (b.classList.contains('kd-dinliyor')) { durdur(); return; }
      var basla = function () {
        var SC = o.secenekler ? o.secenekler() : [];
        if (SC.length) {
          b.classList.add('kd-dinliyor'); goster('Cevabını söyle…');
          return dinle({ kelimeler: SC.map(function (x) { return x.en; }), dil: 'en', sure: 5000, seviye: function (v) { b.style.setProperty('--sv', v.toFixed(2)); } }).then(function (r) {
            b.classList.remove('kd-dinliyor');
            if (r.durum === 'tamam') { goster('“' + r.kelime + '”'); var x = SC.filter(function (y) { return y.en === r.kelime; })[0]; if (x && x.el.isConnected) x.el.click(); return; }
            goster(r.durum === 'sessiz' ? 'Duyamadım' : r.metin ? '“' + r.metin + '”?' : 'Olmadı');
            if (SES()) SES().soyle(r.durum === 'sessiz' ? 'Seni duyamadım. Bir daha söyler misin?' : 'Bir daha dene!', 'tr');
          });
        }
        b.classList.add('kd-dinliyor'); goster('Dinliyorum…');
        dinle({ komut: true, dil: 'tr', sure: 4500, seviye: function (v) { b.style.setProperty('--sv', v.toFixed(2)); } }).then(function (r) {
          b.classList.remove('kd-dinliyor');
          if (r.durum !== 'metin') { goster(r.durum === 'sessiz' ? 'Duyamadım' : r.durum === 'iptal' ? '' : 'Olmadı'); if (r.durum === 'sessiz' && SES()) SES().soyle('Seni duyamadım. Bir daha söyler misin?', 'tr'); return; }
          var c = null; for (var i = 0; i < (r.hepsi || [r.metin]).length && !c; i++) c = komut((r.hepsi || [r.metin])[i], o.konular());
          goster('“' + r.metin + '”');
          if (!c) { if (SES()) SES().soyle('Anlayamadım. Bir daha söyler misin?', 'tr'); return; }
          o.yap(c);
        });
      };
      if (izin() === 'acik') return basla();
      izinSor().then(function (ok) { if (ok) basla(); });
    });
  }

  W.KIDS_DINLE = { destek: destek, izin: izin, izinVer: izinVer, izinSor: izinSor, hazir: hazir, dinle: dinle, tekrarla: tekrarla, eslesir: eslesir, enIyi: enIyi, komut: komut, komutDugmesi: komutDugmesi, durdur: durdur, cumleler: cumleler, gosterge: gosterge, _test: { fon: fon, puan: puan, duz: duz } };
})(window);
