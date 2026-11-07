/* ==========================================================================
   ACADEX ENGLISH · Speaking sınav simülatörü (assets/sinav.js), 07.11.2026
   Üç seviye:
     kolay  Hazırlık atlama mülakatı   ısınma → resim anlatma → görüş + takip   /20, geçti-kaldı (B1 eşiği, tahmini)
     orta   IELTS tarzı                Part 1 → Part 2 (1 dk hazırlık, 2 dk) → Part 3   band 1–9 (tahmini)
     zor    TOEFL iBT 2026 tarzı       Listen & Repeat (7 cümle) → Interview (4 × 45 sn)  1–6 (tahmini)
   İki mod: pratik (bölüm bölüm, ipucu ve tekrar seviyenin izin verdiği kadar, her cevaptan
   sonra kısa geri bildirim) ve sınav (kesintisiz, gerçek süreler, sonda rapor).
   Kayıt: konuşma tanıma (tarayıcı) + ses kaydı (MediaRecorder, yalnız bu cihazda kalır).
   Puan: yerel ölçüm (hız, duraksama, dolgu, çeşitlilik, bağlaç, dilbilgisi, süre, tekrar
   doğruluğu) + yayındaysa ingilizce-hoca 'sinav' modu; ikisi birleştirilir, "tahmini" yazılır.
   Resmî sınavları taklit etmez: rapor Acadex raporudur.
   ========================================================================== */
(function () {
  'use strict';
  var D = document, W = window, A = W.ACX, B = W.SINAV_BANKA, esc = A.esc;
  var SR = W.SpeechRecognition || W.webkitSpeechRecognition;
  var rasgele = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  var bekle = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var sinir = function (x) { return Math.max(0, Math.min(1, x)); };

  var SEV = {
    kolay: { ad: 'Hazırlık atlama', etiket: 'Kolay', tarz: 'Hazırlık yeterlik mülakatı', sure: '~7 dk', olcek: '/20 · geçti-kaldı', hiz: .85,
      bolumler: [['isinma', 'Isınma'], ['resim', 'Resim anlatma'], ['gorus', 'Görüş sorusu']],
      kriter: [['gorev', 'Görev'], ['akici', 'Akıcılık'], ['dogru', 'Doğruluk'], ['kelime', 'Kelime'], ['telaffuz', 'Telaffuz']],
      kural: { ipucu: { pratik: true, sinav: true }, tekrar: { pratik: 9, sinav: 9 }, tr: { pratik: true, sinav: true } } },
    orta: { ad: 'IELTS tarzı', etiket: 'Orta', tarz: 'IELTS tarzı speaking', sure: '11–14 dk', olcek: 'band 1–9', hiz: .95,
      bolumler: [['part1', 'Part 1 · tanışma'], ['part2', 'Part 2 · konu kartı'], ['part3', 'Part 3 · tartışma']],
      kriter: [['akici', 'Akıcılık ve tutarlılık'], ['kelime', 'Kelime zenginliği'], ['dogru', 'Dilbilgisi'], ['telaffuz', 'Telaffuz']],
      kural: { ipucu: { pratik: true, sinav: false }, tekrar: { pratik: 9, sinav: 1 }, tr: { pratik: true, sinav: false } } },
    zor: { ad: 'TOEFL tarzı', etiket: 'Zor', tarz: 'TOEFL iBT (2026) tarzı speaking', sure: '~8 dk', olcek: '1–6 ölçeği', hiz: 1.05,
      bolumler: [['tekrar', 'Listen & Repeat'], ['mulakat', 'Interview']],
      kriter: [['tekrar', 'Dinle-tekrarla doğruluğu'], ['akici', 'Akıcılık'], ['kelime', 'Dil kullanımı'], ['telaffuz', 'Anlaşılırlık']],
      kural: { ipucu: { pratik: false, sinav: false }, tekrar: { pratik: 9, sinav: 0 }, tr: { pratik: true, sinav: false } } }
  };
  var IPUCU = {
    isinma: 'Kısa cevap + bir ayrıntı: “I’m from …, and I really like … because …”',
    resim: 'Şöyle başla: “In this picture, I can see … On the left, … The people are …-ing.”',
    gorus: '“In my opinion, … because … For example, …” Takip sorusuna da bir neden ekle.',
    part1: 'Tek kelimeyle bitirme: cevap + neden + küçük bir örnek. “Well, … The main reason is …”',
    part2: 'Maddeleri sırayla anlat; her madde 20–30 sn. Bitince “So that’s why …” ile bağla.',
    part3: '“It depends. On the one hand … On the other hand …” Genel konuş, örnek ver.'
  };

  /* ---------- seviyeye göre sayfa ---------- */
  var SAYFA = {
    kolay: { adim: [['Isınma', 'Adın, memleketin, bölümün: kısa ve rahat cevaplar. Hoca yavaş konuşur.'], ['Resim anlatma', 'Resimde ne görüyorsun, insanlar ne yapıyor? Bir dakika.'], ['Görüş sorusu', 'Fikrini söyle, bir neden ve örnek ver; takip sorusu gelir.'], ['Sonuç', '/20 puan ve geçti-kaldı tahmini; her cevabının kaydı.']],
      konu: ['mülakat · görüş sorusu', 'Should students have a part-time job while they are studying?', ['kısa bir cevap ver', 'bir neden ekle', 'bir örnek ver', 'takip sorusuna hazır ol']],
      rozet: { gecis: 'Mülakatta takılınca', kart: 'Görüş sorusuna hazırlık', vurgu: 'Anlaşılır konuşma', golge: 'Telaffuz' }, sira: ['gecis', 'kart', 'vurgu', 'golge'] },
    orta: { adim: [['Part 1', 'Kendin hakkında kısa sorular; 4–5 dakika.'], ['Part 2 hazırlık', 'Konu kartı ve bir dakika not; cümle değil kelime yaz.'], ['Part 2 konuşma', 'Bir-iki dakika kesintisiz anlat; hoca 2. dakikada durdurur.'], ['Part 3 ve band', 'Soyut tartışma; sonunda dört kriterde tahmini band.']],
      konu: ['konu kartı · part 2', 'Describe a place on campus where you like to spend time.', ['where it is', 'what you do there', 'who you go there with', 'and explain why you like it']],
      rozet: { kart: 'IELTS Part 2 provası', gecis: 'Part 1–3 akıcılık', vurgu: 'Telaffuz kriteri', golge: 'Telaffuz' }, sira: ['kart', 'gecis', 'vurgu', 'golge'] },
    zor: { adim: [['Listen & Repeat', 'Yedi cümle, her biri bir kez. Duyduğun gibi tekrarla.'], ['Cümleler uzar', 'İlk cümle üç kelime, son cümle on beş kelime. Ritmi tut.'], ['Interview', 'Dört soru, her biri 45 saniye; hazırlık süresi yok.'], ['1–6 puan', 'Doğruluk, akıcılık, dil kullanımı ve anlaşılırlık; tahmini puan.']],
      konu: ['interview · 45 saniye', 'Do you prefer studying in the morning or at night? Why?', ['hazırlık süresi yok', 'hemen başla', 'bir neden ve bir örnek', '45 saniyeyi doldur']],
      rozet: { golge: 'TOEFL Listen & Repeat hazırlığı', gecis: 'Interview: hazırlıksız başlama', vurgu: 'Anlaşılırlık', kart: 'Uzun cevap pratiği' }, sira: ['golge', 'gecis', 'vurgu', 'kart'] }
  };
  function sayfaUyarla(lv) {
    var s = SAYFA[lv]; D.body.dataset.seviye = lv;
    D.querySelectorAll('.sahne .adimlar li').forEach(function (li, i) { if (s.adim[i]) li.innerHTML = '<div><b>' + esc(s.adim[i][0]) + '</b><span>' + esc(s.adim[i][1]) + '</span></div>'; });
    var k = D.querySelector('.sahne .konu');
    if (k) { k.querySelector('.etiket').textContent = s.konu[0]; k.querySelector('h3').textContent = s.konu[1]; var ul = k.querySelector('ul'); ul.innerHTML = s.konu[2].map(function (x) { return '<li>' + esc(x) + '</li>'; }).join(''); ul.lang = lv === 'orta' ? 'en' : 'tr'; }
    D.querySelectorAll('#calis .alis').forEach(function (a) {
      var r = a.querySelector('.sv-rozet'); if (!r) { r = D.createElement('span'); r.className = 'sv-rozet'; a.querySelector('.alis-u div').prepend(r); }
      r.textContent = s.rozet[a.dataset.id] || ''; r.hidden = !s.rozet[a.dataset.id];
      a.style.order = s.sira.indexOf(a.dataset.id) < 0 ? 9 : s.sira.indexOf(a.dataset.id);
    });
  }

  /* ---------- resim sahneleri (kolay · resim anlatma) ---------- */
  var IN = '#1A2A5C';
  var KISI = function (x, y, renk, sac, poz) {
    return '<g transform="translate(' + x + ' ' + y + ')"><circle cx="0" cy="-34" r="11" fill="#EDBE97" stroke="' + IN + '" stroke-width="2"/><path d="M-11 -36 q11 -14 22 0" fill="' + sac + '" stroke="' + IN + '" stroke-width="2"/>' +
      '<path d="M-14 0 q0 -22 14 -22 q14 0 14 22 z" fill="' + renk + '" stroke="' + IN + '" stroke-width="2"/>' + (poz || '') + '</g>';
  };
  var RESIM = {
    kutuphane: '<rect x="0" y="0" width="400" height="240" fill="#F3EAD7"/><rect x="20" y="20" width="110" height="150" fill="#D9C29A" stroke="' + IN + '" stroke-width="2.5"/>' + [40, 75, 110, 145].map(function (y) { return '<path d="M20 ' + y + ' H130" stroke="' + IN + '" stroke-width="2"/><rect x="26" y="' + (y - 22) + '" width="10" height="20" fill="#C93B2B"/><rect x="40" y="' + (y - 18) + '" width="8" height="16" fill="#2D5BD3"/><rect x="52" y="' + (y - 24) + '" width="12" height="22" fill="#2C7A4B"/><rect x="90" y="' + (y - 20) + '" width="10" height="18" fill="#E3A80F"/>'; }).join('') +
      '<circle cx="300" cy="40" r="18" fill="#fff" stroke="' + IN + '" stroke-width="2.5"/><path d="M300 40 V28 M300 40 H310" stroke="' + IN + '" stroke-width="2"/><rect x="170" y="20" width="80" height="60" fill="#CFE7F2" stroke="' + IN + '" stroke-width="2.5"/>' +
      KISI(220, 170, '#2D5BD3', '#3B2416') + KISI(310, 170, '#DD5A36', '#6A4330') + '<rect x="160" y="168" width="220" height="12" fill="#B48C5E" stroke="' + IN + '" stroke-width="2.5"/><path d="M175 180 V230 M365 180 V230" stroke="' + IN + '" stroke-width="3"/>' +
      '<path d="M200 168 l10 -18 h26 l-6 18z" fill="#3F4A68" stroke="' + IN + '" stroke-width="2"/><rect x="288" y="158" width="30" height="10" fill="#fff" stroke="' + IN + '" stroke-width="2"/><path d="M303 158 v10" stroke="' + IN + '" stroke-width="1.5"/>',
    kafe: '<rect x="0" y="0" width="400" height="240" fill="#F6E3D3"/><rect x="20" y="20" width="160" height="50" fill="#1E2850" stroke="' + IN + '" stroke-width="2.5"/><text x="34" y="40" fill="#fff" font-size="12" font-family="monospace">MENU</text><path d="M34 50 h60 M34 60 h80 M110 40 h50" stroke="#fff" stroke-width="2"/>' +
      '<rect x="20" y="130" width="170" height="70" fill="#C9A57A" stroke="' + IN + '" stroke-width="2.5"/>' + KISI(90, 130, '#2C7A4B', '#3B2416', '<path d="M-10 -8 h20" stroke="#fff" stroke-width="2"/>') + '<rect x="140" y="104" width="22" height="26" fill="#9AA2BB" stroke="' + IN + '" stroke-width="2"/>' +
      KISI(250, 200, '#DD5A36', '#6A4330') + KISI(330, 200, '#2D5BD3', '#26140A') + '<ellipse cx="290" cy="200" rx="60" ry="10" fill="#C9A57A" stroke="' + IN + '" stroke-width="2.5"/><path d="M290 210 V238" stroke="' + IN + '" stroke-width="3"/>' +
      '<rect x="262" y="182" width="14" height="14" rx="2" fill="#fff" stroke="' + IN + '" stroke-width="2"/><rect x="302" y="182" width="14" height="14" rx="2" fill="#fff" stroke="' + IN + '" stroke-width="2"/><path d="M266 176 q-3 -6 0 -10 M306 176 q-3 -6 0 -10" stroke="#8A93AE" stroke-width="2" fill="none"/>',
    park: '<rect x="0" y="0" width="400" height="240" fill="#D7ECF5"/><circle cx="350" cy="40" r="22" fill="#FFD86B" stroke="' + IN + '" stroke-width="2.5"/><rect x="0" y="170" width="400" height="70" fill="#9ED4AE" stroke="' + IN + '" stroke-width="2.5"/>' +
      '<path d="M60 170 V110" stroke="#7A4A2A" stroke-width="10"/><circle cx="60" cy="90" r="40" fill="#2C7A4B" stroke="' + IN + '" stroke-width="2.5"/><path d="M110 150 h90 M115 150 v22 M195 150 v22 M110 136 h90" stroke="#7A4A2A" stroke-width="6"/>' + KISI(140, 150, '#E3A80F', '#3B2416') +
      KISI(270, 200, '#2D5BD3', '#26140A', '<path d="M12 -10 L40 4" stroke="' + IN + '" stroke-width="2"/>') + '<ellipse cx="320" cy="208" rx="16" ry="9" fill="#B07F00" stroke="' + IN + '" stroke-width="2"/><circle cx="334" cy="200" r="6" fill="#B07F00" stroke="' + IN + '" stroke-width="2"/>' +
      KISI(200, 225, '#DD5A36', '#6A4330') + '<circle cx="228" cy="214" r="9" fill="#C93B2B" stroke="' + IN + '" stroke-width="2"/>',
    durak: '<rect x="0" y="0" width="400" height="240" fill="#B9C6D6"/>' + Array.apply(null, Array(30)).map(function (_, i) { return '<path d="M' + (i * 14 % 400) + ' ' + (i * 37 % 160) + ' l-4 10" stroke="#6E86A6" stroke-width="2"/>'; }).join('') +
      '<rect x="0" y="200" width="400" height="40" fill="#8B97A8" stroke="' + IN + '" stroke-width="2.5"/><rect x="20" y="70" width="150" height="130" fill="none" stroke="' + IN + '" stroke-width="3"/><path d="M10 70 h170" stroke="' + IN + '" stroke-width="6"/>' +
      KISI(60, 200, '#2C7A4B', '#3B2416', '<path d="M-26 -52 q26 -22 52 0 z" fill="#C93B2B" stroke="' + IN + '" stroke-width="2"/><path d="M0 -52 v20" stroke="' + IN + '" stroke-width="2"/>') + KISI(120, 200, '#E3A80F', '#26140A', '<rect x="8" y="-24" width="8" height="12" fill="#1A2A5C"/>') +
      '<rect x="230" y="110" width="160" height="80" rx="10" fill="#0F8582" stroke="' + IN + '" stroke-width="3"/><path d="M242 124 h30 v24 h-30z M282 124 h30 v24 h-30z M322 124 h30 v24 h-30z" fill="#D7ECF5" stroke="' + IN + '" stroke-width="2"/><circle cx="262" cy="192" r="11" fill="' + IN + '"/><circle cx="360" cy="192" r="11" fill="' + IN + '"/><text x="362" y="140" fill="#fff" font-size="14" font-family="monospace">42</text>'
  };

  /* ---------- plan: seviye + mod → adımlar ---------- */
  var gor = A.ls.al('spGorulen', {});
  function sec(anahtar, liste) {   /* son görülenleri atla */
    var g = gor[anahtar] || [], aday = liste.map(function (_, i) { return i; }).filter(function (i) { return g.indexOf(i) < 0; });
    if (!aday.length) { g = []; aday = liste.map(function (_, i) { return i; }); }
    var i = rasgele(aday); g.push(i); gor[anahtar] = g.slice(-Math.max(1, liste.length - 1)); A.ls.yaz('spGorulen', gor); return liste[i];
  }
  var HAVUZ = ['kolay:isinma', 'kolay:gorus', 'orta:part1', 'orta:part2', 'zor:tekrar', 'zor:mulakat'];
  async function havuz(lv, bolum) {
    if (!A.icerik) return null;
    return Promise.race([A.icerik('sinav', lv + ':' + bolum), bekle(7000).then(function () { return null; })]).catch(function () { return null; });
  }
  async function planKur(lv, mod, tek) {
    var P = [], ist = function (b) { return !tek || tek === b; };
    var h = {}; await Promise.all(SEV[lv].bolumler.map(function (b) { return ist(b[0]) && HAVUZ.indexOf(lv + ':' + b[0]) > -1 ? havuz(lv, b[0]).then(function (v) { h[b[0]] = v; }) : null; }));
    if (lv === 'kolay') {
      if (ist('isinma')) {
        var qs = h.isinma && Array.isArray(h.isinma.sorular) ? h.isinma.sorular.slice(0, 3) : [sec('k-i1', B.kolay.isinma), sec('k-i2', B.kolay.isinma), sec('k-i3', B.kolay.isinma)];
        P.push({ b: 'isinma', tip: 'soru', soru: 'Can you tell me your full name, please?', sure: 15, giris: "Good morning. I'm Defne, and I'll be your examiner today.", giris_tr: 'Günaydın, ben Defne; bugün seni ben dinleyeceğim. Önce birkaç kısa soru.' });
        qs.forEach(function (q) { P.push({ b: 'isinma', tip: 'soru', soru: String(q), sure: 30 }); });
      }
      if (ist('resim')) { var r = sec('k-r', B.kolay.resim); P.push({ b: 'resim', tip: 'resim', resim: r, soru: 'Please look at this picture. Describe what you can see and what the people are doing.', hazirlik: mod === 'pratik' ? 20 : 10, sure: 60, giris: "Now, I'd like you to look at a picture.", giris_tr: 'Şimdi bir resim göstereceğim; gördüklerini anlat.' }); }
      if (ist('gorus')) {
        var g = h.gorus && Array.isArray(h.gorus.sorular) && h.gorus.sorular[0] && h.gorus.sorular[0].soru ? [h.gorus.sorular[0].soru, h.gorus.sorular[0].takip] : sec('k-g', B.kolay.gorus);
        P.push({ b: 'gorus', tip: 'soru', soru: String(g[0]), sure: 60, giris: "Thank you. Finally, I'd like to ask your opinion about something.", giris_tr: 'Son bölüm: fikrini soracağım.' });
        P.push({ b: 'gorus', tip: 'soru', soru: String(g[1] || 'Why do you think so?'), sure: 40, takip: true });
      }
    } else if (lv === 'orta') {
      var t1 = h.part1 && h.part1.konu && Array.isArray(h.part1.sorular) ? h.part1 : sec('o-1', B.orta.part1);
      var t2 = h.part2 && h.part2.kart && Array.isArray(h.part2.maddeler) && Array.isArray(h.part2.part3) ? h.part2 : sec('o-2', B.orta.part2);
      if (ist('part1')) t1.sorular.slice(0, 4).forEach(function (q, i) { P.push({ b: 'part1', tip: 'soru', soru: String(q), sure: 30, giris: i ? '' : "In this first part, I'm going to ask you some questions about yourself. Let's talk about " + t1.konu + '.', giris_tr: i ? '' : 'Birinci bölüm: kendinle ilgili kısa sorular.' }); });
      if (ist('part2')) {
        P.push({ b: 'part2', tip: 'kart', kart: t2, soru: String(t2.kart), hazirlik: 60, sure: 120, enaz: 60, giris: "Now I'm going to give you a topic. You'll have one minute to prepare, and then I'd like you to talk for one to two minutes.", giris_tr: 'Konu kartı: bir dakika hazırlık, sonra bir-iki dakika konuşma.' });
        if (t2.kapanis) P.push({ b: 'part2', tip: 'soru', soru: String(t2.kapanis), sure: 20 });
      }
      if (ist('part3')) t2.part3.slice(0, 4).forEach(function (q, i) { P.push({ b: 'part3', tip: 'soru', soru: String(q), sure: 45, giris: i ? '' : "We've been talking about " + String(t2.kart).replace(/^Describe /, '').replace(/\.$/, '') + ". Now I'd like to discuss some more general questions.", giris_tr: i ? '' : 'Üçüncü bölüm: daha genel, soyut sorular.' }); });
    } else {
      var lr = h.tekrar && Array.isArray(h.tekrar.cumleler) && h.tekrar.cumleler.length >= 5 ? h.tekrar : sec('z-t', B.zor.tekrar);
      var iv = h.mulakat && Array.isArray(h.mulakat.sorular) ? h.mulakat : sec('z-m', B.zor.mulakat);
      if (ist('tekrar')) lr.cumleler.slice(0, 7).forEach(function (c, i) { var n = String(c).split(/\s+/).length; P.push({ b: 'tekrar', tip: 'tekrar', hedef: String(c), soru: String(c), sure: Math.round(6 + n * .55), giris: i ? '' : 'In this task, you will hear seven sentences about ' + lr.baglam + '. After each one, repeat it exactly as you hear it.', giris_tr: i ? '' : 'Yedi cümle duyacaksın; her birini duyduğun gibi tekrarla.' }); });
      if (ist('mulakat')) iv.sorular.slice(0, 4).forEach(function (q, i) { P.push({ b: 'mulakat', tip: 'soru', soru: String(q), sure: 45, giris: i ? '' : 'Now you will take part in a short interview about ' + iv.konu + '. You will have 45 seconds to answer each question.', giris_tr: i ? '' : 'Kısa bir mülakat: her soruya 45 saniye, hazırlık yok.' }); });
    }
    return P;
  }

  /* ---------- ölçüm ve puan ---------- */
  var DOLGU = /\b(um+|uh+|erm+|er|hmm+|ehm+)\b/gi;
  var BAG = /\b(because|so|however|although|for example|for instance|which|when|if|but|also|while|whereas|therefore|actually|on the other hand|in my opinion|first|then|finally)\b/gi;
  var YAN = /\b(because|although|which|that|if|when|while|who|since|unless|whereas)\b/gi;
  var BOS = /^(the|a|an|and|or|to|of|in|on|at|is|are|was|were|i|you|it|do|does|what|how|why|your|my|me|be|for|with|this|that|can|would|like|about|please|tell)$/;
  function olc(c, a) {
    var t = String(c.metin || ''), n0 = HOCA.norm(t).trim(), ks = n0 ? n0.split(' ') : [], n = ks.length, sn = Math.max(1, c.sn || 1);
    var o = { kelime: n, sn: Math.round(sn), wpm: Math.round(n / (sn / 60)), dolgu: (t.match(DOLGU) || []).length, cesit: n ? Object.keys(ks.reduce(function (m, w) { m[w] = 1; return m; }, {})).length / n : 0,
      uzun: n ? ks.filter(function (w) { return w.length >= 7; }).length / n : 0, bag: (t.match(BAG) || []).length, yan: (t.match(YAN) || []).length, gram: HOCA.gramer(t), doluluk: sinir(sn / (a.enaz || a.sure)), guven: c.guven || 0 };
    if (a.tip === 'tekrar') { var d = HOCA.dikteDegerlendir(t || '-', a.hedef); o.isabet = 1 - d.kacan.length / Math.max(1, HOCA.norm(a.hedef).trim().split(' ').length); o.kacan = d.kacan; }
    var anahtar = a.tip === 'resim' ? a.resim.anahtar : HOCA.norm(a.soru).trim().split(' ').filter(function (w) { return w.length > 3 && !BOS.test(w); });
    o.ilgi = anahtar.length ? sinir(anahtar.filter(function (w) { return n0.indexOf(w.slice(0, 5)) > -1; }).length / (a.tip === 'resim' ? 4 : Math.max(1, Math.min(2, anahtar.length)))) : 1;
    return o;
  }
  function kriterYerel(lv, cevaplar) {
    var top = {}, agir = {};
    var ekle = function (k, x, w) { top[k] = (top[k] || 0) + x * w; agir[k] = (agir[k] || 0) + w; };
    cevaplar.forEach(function (c) {
      var o = c.olcum, w = Math.max(.4, c.adim.sure / 60), az = o.kelime < 5 ? .35 : 1, uz = .55 + .45 * sinir(o.kelime / Math.max(15, c.adim.sure * 1.4));   /* kısa cevap dil aralığını gösteremez */
      if (c.adim.tip === 'tekrar') { ekle('tekrar', o.isabet, 1); ekle('telaffuz', (o.guven || .6) * .4 + o.isabet * .6, .5); return; }
      ekle('akici', az * uz * (sinir((o.wpm - 40) / 80) * .45 + (1 - sinir(o.dolgu / Math.max(1, o.kelime) * 8)) * .25 + o.doluluk * .3) * (c.duraks ? 1 - sinir(c.duraks / 5) * .25 : 1), w);
      ekle('kelime', az * uz * (sinir((o.cesit - .35) / .35) * .4 + sinir(o.uzun / .18) * .3 + sinir(o.bag / Math.max(1, o.kelime / 25)) * .3), w);
      ekle('dogru', az * uz * ((1 - sinir(o.gram.length / Math.max(1, o.kelime / 20))) * .6 + sinir(o.yan / Math.max(1, o.kelime / 30)) * .4), w);
      ekle('telaffuz', az * (o.guven ? sinir((o.guven - .5) / .4) : .6) * .7 + o.doluluk * .3, w * .8);
      ekle('gorev', (o.ilgi * .5 + o.doluluk * .3 + sinir(o.kelime / 12) * .2) * (c.ipucu ? .85 : 1), w);
    });
    var k = {}; SEV[lv].kriter.forEach(function (x) { k[x[0]] = agir[x[0]] ? top[x[0]] / agir[x[0]] : 0; }); return k;
  }
  var OLCEK = {
    kolay: { cevir: function (x) { return Math.round(x * 4); }, genel: function (k) { var s = 0; Object.keys(k).forEach(function (a) { s += k[a]; }); return s; }, max: 4, gmax: 20, yaz: function (v) { return String(v); } },
    orta: { cevir: function (x) { return Math.max(1, Math.min(9, Math.round((2.5 + 6.5 * x) * 2) / 2)); }, genel: function (k) { var s = 0, n = 0; Object.keys(k).forEach(function (a) { s += k[a]; n++; }); return Math.round(s / n * 2) / 2; }, max: 9, gmax: 9, yaz: function (v) { return v.toFixed(1); } },
    zor: { cevir: function (x) { return Math.max(1, Math.min(6, Math.round((1 + 5 * x) * 2) / 2)); }, genel: function (k) { var s = 0, n = 0; Object.keys(k).forEach(function (a) { s += k[a]; n++; }); return Math.round(s / n * 2) / 2; }, max: 6, gmax: 6, yaz: function (v) { return v.toFixed(1); } }
  };
  function duzeltmeYerel(cevaplar) {
    var out = [];
    cevaplar.forEach(function (c) { c.olcum.gram && c.olcum.gram.forEach(function (g) {
      var cumle = ((String(c.metin).match(/[^.!?]+[.!?]*/g) || []).filter(function (s) { return s.toLowerCase().indexOf(g.parca.toLowerCase()) > -1; })[0] || c.metin).trim();
      var iyi = /^[a-z' ]+$/i.test(g.oneri) ? cumle.replace(new RegExp(g.parca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), g.oneri) : '';
      if (out.length < 6) out.push({ orijinal: cumle, daha_iyi: iyi, not_tr: g.tr });
    }); });
    return out;
  }

  /* ---------- kayıt: konuşma tanıma + ses ---------- */
  var akis = null;
  async function mikrofon() { if (akis) return akis; try { akis = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { akis = null; } return akis; }
  function kaydet() {
    var r = null, parca = [];
    if (akis && W.MediaRecorder) { try { r = new MediaRecorder(akis); r.ondataavailable = function (e) { if (e.data.size) parca.push(e.data); }; r.start(); } catch (e) { r = null; } }
    return { dur: function () { return new Promise(function (son) { if (!r || r.state === 'inactive') return son(''); r.onstop = function () { son(parca.length ? URL.createObjectURL(new Blob(parca, { type: r.mimeType || 'audio/webm' })) : ''); }; try { r.stop(); } catch (e) { son(''); } }); } };
  }
  function dinle(guncelle) {
    if (!SR) return null;
    var r = new SR(), son = [], gecici = '', guv = [], aktif = true, bitince = null;
    r.lang = 'en-GB'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = function (e) { gecici = ''; for (var i = e.resultIndex; i < e.results.length; i++) { var x = e.results[i]; if (x.isFinal) { son.push(x[0].transcript); if (x[0].confidence) guv.push(x[0].confidence); } else gecici += x[0].transcript; } guncelle((son.join(' ') + ' ' + gecici).trim()); };
    r.onend = function () { if (aktif) { try { r.start(); } catch (e) {} } else if (bitince) bitince(); };
    r.onerror = function (e) { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { aktif = false; guncelle(null); } };
    try { r.start(); } catch (e) { return null; }
    return { dur: function () { aktif = false; return new Promise(function (ok) { bitince = function () { ok({ metin: (son.join(' ') + ' ' + gecici).trim(), guven: guv.length ? guv.reduce(function (a, b) { return a + b; }, 0) / guv.length : 0 }); }; try { r.stop(); } catch (e) { bitince(); } setTimeout(function () { if (bitince) bitince(); bitince = null; }, 1500); }); } };
  }

  /* ---------- canlı ses seviyesi (Web Audio): dalga, halka, duraksama ---------- */
  var actx = null;
  function seviyeOlcer() {
    var C = W.AudioContext || W.webkitAudioContext; if (!akis || !C) return null;
    var src, an;
    try { actx = actx || new C(); if (actx.state === 'suspended') actx.resume(); src = actx.createMediaStreamSource(akis); an = actx.createAnalyser(); an.fftSize = 512; src.connect(an); } catch (e) { return null; }
    var buf = new Uint8Array(an.fftSize);
    return { oku: function () { an.getByteTimeDomainData(buf); var t = 0; for (var i = 0; i < buf.length; i++) { var v = (buf[i] - 128) / 128; t += v * v; } return Math.min(1, Math.sqrt(t / buf.length) * 5); }, kapat: function () { try { src.disconnect(); } catch (e) {} } };
  }
  var SESSIZ = .07, DURAKSAMA = 2.5;   /* bu seviyenin altı sessizlik; 2,5 sn ve üstü "uzun duraksama" */

  /* ---------- renkli transkript ---------- */
  var BAGLAC = /\b(because|however|although|therefore|moreover|furthermore|whereas|while|which|so|but|also|actually|finally|firstly|first|then|besides|instead|unless|since|for example|for instance|on the other hand|in my opinion|as a result|in addition|to be honest|i mean)\b/gi;
  var SIRADAN = /^(something|everything|anything|sometimes|probably|tomorrow|yesterday|children|favourite|favorite|important|different|interesting|students|everyone|somebody|everybody|beautiful|wonderful|together|actually|because|although|therefore|whenever|nowadays|basically)$/;
  function guclu(w) { w = w.toLowerCase(); return w.replace(/(ies|s)$/, '').length >= 8 && !SIRADAN.test(w) && !SIRADAN.test(w.replace(/s$/, '')); }   /* çoğul eki uzunluk sayılmaz */
  function renkle(metin, isaret) {
    var t = String(metin || ''), r = [];
    var ekle = function (re, cls, oncelik, baslik) { var m; re.lastIndex = 0; while ((m = re.exec(t))) { if (!m[0]) { re.lastIndex++; continue; } r.push({ s: m.index, e: m.index + m[0].length, c: cls, o: oncelik, b: baslik || '' }); } };
    (isaret || []).forEach(function (g) {
      var parca = String(g.parca || '').trim(); if (!parca || parca.length > 80) return;
      var i = t.toLowerCase().indexOf(parca.toLowerCase()); if (i > -1) r.push({ s: i, e: i + parca.length, c: 't-hata', o: 4, b: (g.tr || '') + (g.oneri ? ' → ' + g.oneri : '') });
    });
    ekle(new RegExp(DOLGU.source, 'gi'), 't-dolgu', 3, 'dolgu sesi');
    ekle(new RegExp(BAGLAC.source, 'gi'), 't-bag', 2, 'bağlaç');
    var gm, gre = /\b[a-z]{8,}\b/gi; while ((gm = gre.exec(t))) if (guclu(gm[0])) r.push({ s: gm.index, e: gm.index + gm[0].length, c: 't-guclu', o: 1, b: 'güçlü kelime' });
    r.sort(function (a, b) { return a.s - b.s || b.o - a.o; });
    var secili = [];
    r.forEach(function (x) { var cak = secili.filter(function (y) { return x.s < y.e && y.s < x.e; }); if (!cak.length) secili.push(x); else if (cak.every(function (y) { return y.o < x.o; })) { secili = secili.filter(function (y) { return cak.indexOf(y) < 0; }); secili.push(x); } });
    secili.sort(function (a, b) { return a.s - b.s; });
    var out = '', k = 0;
    secili.forEach(function (x) { out += esc(t.slice(k, x.s)) + '<span class="' + x.c + '"' + (x.b ? ' title="' + esc(x.b) + '"' : '') + '>' + esc(t.slice(x.s, x.e)) + '</span>'; k = x.e; });
    return out + esc(t.slice(k));
  }
  var RENK_ANAHTAR = '<div class="t-anahtar"><span class="t-bag">bağlaç</span><span class="t-guclu">güçlü kelime</span><span class="t-dolgu">um / uh</span><span class="t-hata">düzeltilecek</span></div>';

  /* ---------- model cevap: bir üst seviye örnek, seninkiyle yan yana ---------- */
  var HEDEF = { kolay: 'B1+ (iyi bir hazırlık atlama cevabı)', orta: 'band 7–8', zor: '5–6 puan' };
  var ISKELET = {
    isinma: ['Well, I’m from …, a … city in …', 'What I like most is …, because …', 'For example, …'],
    resim: ['In this picture, I can see … in a …', 'On the left, … is …-ing, while on the right …', 'It looks like … because …', 'I think they feel … since …'],
    gorus: ['In my opinion, … because …', 'For example, when I …, I …', 'On the other hand, some people think …', 'So overall, I believe …'],
    part1: ['Well, to be honest, …', 'The main reason is that …', 'For instance, last week I …'],
    part2: ['I’d like to talk about …, which …', 'It was / is … and I usually …', 'What I remember most is …', 'The reason it matters to me is that …', 'So that’s why …'],
    part3: ['It depends. On the one hand, …', 'On the other hand, …', 'A good example of this is …', 'So in general, I’d say …'],
    mulakat: ['That’s a good question. Personally, …', 'The main reason is …', 'For example, in my case …', 'So, if I had to choose, I’d …']
  };
  var modelBellek = A.ls.al('spModel', {});
  async function modelGetir(c, lv) {
    var anahtar = lv + '|' + c.adim.soru; if (modelBellek[anahtar]) return modelBellek[anahtar];
    var v = await A.yz('sinav_model', { seviye: lv, bolum: c.adim.b, soru: c.adim.soru, cevap: String(c.metin || '').slice(0, 1500), sn: c.adim.sure }, 25000);
    if (!v || typeof v.model_en !== 'string' || !v.model_en.trim()) return null;
    var m = { model_en: v.model_en, notlar: Array.isArray(v.notlar) ? v.notlar.map(String).slice(0, 3) : [] };
    modelBellek[anahtar] = m; var ks = Object.keys(modelBellek); if (ks.length > 40) delete modelBellek[ks[0]]; A.ls.yaz('spModel', modelBellek); return m;
  }
  function eksikler(senin, model) {   /* modelde olup seninkinde olmayan bağlaç ve güçlü kelimeler */
    var sn = ' ' + HOCA.norm(senin).trim() + ' ', out = [], gor = {};
    var ek = function (w) { var k = w.toLowerCase(); if (gor[k] || sn.indexOf(' ' + HOCA.norm(k).trim() + ' ') > -1) return; gor[k] = 1; out.push(w); };
    (String(model).match(new RegExp(BAGLAC.source, 'gi')) || []).forEach(ek);
    (String(model).match(/\b[a-z]{8,}\b/gi) || []).filter(guclu).forEach(ek);
    return out.slice(0, 8);
  }
  function modelIsaretle(model, eks) {
    var html = renkle(model, []);
    if (!eks.length) return html;
    var re = new RegExp('(<span class="t-(?:bag|guclu)"[^>]*>)(' + eks.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')(</span>)', 'gi');
    return html.replace(re, function (_, a, w, z) { return a.replace('class="', 'class="t-yeni ') + w + z; });
  }
  async function modelAc(li, c, lv) {
    var kutu = li.querySelector('.rp-model'), dug = li.querySelector('[data-model]');
    if (!kutu.hidden && kutu.dataset.dolu) { kutu.hidden = true; dug.setAttribute('aria-expanded', 'false'); return; }
    kutu.hidden = false; dug.setAttribute('aria-expanded', 'true');
    if (kutu.dataset.dolu) return;
    kutu.innerHTML = '<p class="el" style="font-size:20px;margin:6px 0">Defne Hoca örnek cevap yazıyor…</p>';
    var m = await modelGetir(c, lv);
    if (!m) {
      var isk = ISKELET[c.adim.b] || ISKELET.part1;
      kutu.innerHTML = '<div class="rp-yanyana"><div><span class="etiket">senin cevabın</span><p lang="en">' + (c.metin ? renkle(c.metin, c.olcum.gram) : '<span class="say">(algılanmadı)</span>') + '</p></div><div class="rp-ornek"><span class="etiket">yapı örneği</span><ol lang="en">' + isk.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></div></div>' +
        '<p class="say">Tam model cevap yapay zekâ bağlanınca gelir; şimdilik ' + esc(HEDEF[lv]) + ' bir cevabın iskeleti. Boşlukları kendi fikrinle doldurup sesli dene.</p>';
      kutu.dataset.dolu = 1; return;
    }
    var eks = eksikler(c.metin, m.model_en);
    kutu.innerHTML = '<div class="rp-yanyana"><div><span class="etiket">senin cevabın</span><p lang="en">' + (c.metin ? renkle(c.metin, c.olcum.gram) : '<span class="say">(algılanmadı)</span>') + '</p></div>' +
      '<div class="rp-ornek"><span class="etiket">örnek · ' + esc(HEDEF[lv]) + '</span><p lang="en">' + modelIsaretle(m.model_en, eks) + '</p></div></div>' +
      (eks.length ? '<p class="rp-eks"><b>Örnekte olup seninkinde olmayanlar:</b> ' + eks.map(function (w) { return '<span class="t-yeni" lang="en">' + esc(w) + '</span>'; }).join(' ') + '</p>' : '') +
      (m.notlar.length ? '<ul class="rp-not">' + m.notlar.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="alt-satir" style="margin-top:8px"><span class="say">Örnek tek doğru değil; fikir senin, kalıpları al.</span><button type="button" class="btn sm" data-oku>🔊 Hoca okusun</button></div>';
    kutu.dataset.dolu = 1;
    kutu.querySelector('[data-oku]').onclick = function () { h.soyle(m.model_en, '', { hiz: SEV[lv].hiz }); };
  }

  /* ---------- arayüz ---------- */
  var kok, h, durum = { lv: A.ls.al('spSeviye', 'orta'), mod: 'sinav', tek: null, calisiyor: false, iptal: false };
  function kural(ad) { var k = SEV[durum.lv].kural[ad]; return k[durum.mod]; }
  function kur(el) {
    kok = el;
    el.innerHTML = '<div class="sv-ust"><div class="sv-biletler" role="radiogroup" aria-label="Zorluk">' + Object.keys(SEV).map(function (k) {
      var s = SEV[k]; return '<button type="button" class="sv-bilet kagit" role="radio" data-lv="' + k + '"><span class="etiket">' + s.etiket + '</span><b>' + esc(s.ad) + '</b><small>' + esc(s.tarz) + '</small><span class="sv-bilgi2">' + esc(s.sure) + ' · ' + esc(s.olcek) + '</span></button>'; }).join('') + '</div>' +
      '<div class="sv-mod" role="radiogroup" aria-label="Mod"><button type="button" role="radio" data-mod="pratik">Pratik</button><button type="button" role="radio" data-mod="sinav">Sınav</button></div></div>' +
      '<div class="sv-oda"><div class="sv-hoca"></div><div class="sv-panel kagit" aria-live="polite"></div></div><div class="sv-rapor"></div><div class="sv-gelisim kagit"></div>';
    h = HOCA.sahne(el.querySelector('.sv-hoca'));
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lv],[data-mod]'); if (!b || durum.calisiyor) return;
      if (b.dataset.lv) { durum.lv = b.dataset.lv; A.ls.yaz('spSeviye', durum.lv); durum.tek = null; sayfaUyarla(durum.lv); }
      if (b.dataset.mod) { durum.mod = b.dataset.mod; durum.tek = null; }
      secimCiz(); karsila(); gelisimCiz();
    });
    sayfaUyarla(durum.lv); secimCiz(); karsila(); gelisimCiz();
  }
  function secimCiz() {
    kok.querySelectorAll('[data-lv]').forEach(function (b) { b.setAttribute('aria-checked', b.dataset.lv === durum.lv); });
    kok.querySelectorAll('[data-mod]').forEach(function (b) { b.setAttribute('aria-checked', b.dataset.mod === durum.mod); });
    kok.dataset.lv = durum.lv;
    var p = kok.querySelector('.sv-panel'), s = SEV[durum.lv], tik = function (v) { return v ? '✓' : '✗'; };
    p.innerHTML = '<span class="etiket">' + esc(s.tarz) + ' · ' + (durum.mod === 'sinav' ? 'tam sınav' : 'pratik') + '</span><h3>' + (durum.mod === 'sinav' ? 'Baştan sona, gerçek sürelerle' : 'Bir bölüm seç, istediğin kadar dene') + '</h3>' +
      '<div class="sv-bolumler">' + s.bolumler.map(function (b, i) { return durum.mod === 'pratik' ? '<button type="button" class="btn sm" data-tek="' + b[0] + '" aria-pressed="' + (durum.tek === b[0] || (!durum.tek && !i)) + '">' + esc(b[1]) + '</button>' : '<span class="sv-bol">' + (i + 1) + '. ' + esc(b[1]) + '</span>'; }).join('') + '</div>' +
      '<ul class="sv-kural"><li>' + tik(kural('ipucu')) + ' Acadia ipucu</li><li>' + (kural('tekrar') ? '✓ Soruyu tekrar ettirme' + (kural('tekrar') === 1 ? ' (bir kez)' : '') : '✗ Soru tekrarı yok') + '</li><li>' + tik(kural('tr')) + ' Türkçe açıklama</li><li>' + (durum.mod === 'pratik' ? '✓ Her cevaptan sonra kısa geri bildirim' : '✓ Sonda rapor, kayıtlar ve düzeltmeler') + '</li></ul>' +
      (SR ? '' : '<p class="say">Bu tarayıcı konuşmayı yazıya çeviremiyor; cevaplarını yazarak vereceksin (Chrome ya da Edge önerilir).</p>') +
      '<div class="alt-satir"><span class="say">' + esc(s.sure) + ' · ' + esc(s.olcek) + ' · puanlar tahminidir</span><button type="button" class="btn ana" data-basla>' + (durum.mod === 'sinav' ? 'Sınava başla' : 'Bu bölümü çalış') + '</button></div>';
    if (!durum.tek && durum.mod === 'pratik') durum.tek = s.bolumler[0][0];
    p.querySelectorAll('[data-tek]').forEach(function (b) { b.onclick = function () { durum.tek = b.dataset.tek; secimCiz(); }; });
    p.querySelector('[data-basla]').onclick = baslat;
  }
  function karsila() {
    h.svg.classList.toggle('gozetmen', durum.mod === 'sinav');
    var s = SEV[durum.lv];
    h.soyle(durum.mod === 'sinav' ? 'When you are ready, we can start the ' + (durum.lv === 'orta' ? 'speaking test' : durum.lv === 'zor' ? 'speaking section' : 'interview') + '.' : "Let's practise. Choose a part, and take your time.", kural('tr') ? s.tarz + ' · ' + (durum.mod === 'sinav' ? 'hazır olduğunda başlıyoruz.' : 'bir bölüm seç, rahat çalış.') : '');
  }

  /* bir adımı sor, cevabı al */
  function halka(p, kalan, top, etiket) { p.querySelector('.sv-saat').style.setProperty('--k', sinir(kalan / top)); p.querySelector('.sv-saat b').textContent = Math.floor(kalan / 60) + ':' + ('0' + Math.max(0, Math.ceil(kalan) % 60)).slice(-2); p.querySelector('.sv-saat small').textContent = etiket; }
  function goster(p) { var r = p.getBoundingClientRect(); if (r.top < 70 || r.top > W.innerHeight * .55) p.scrollIntoView({ behavior: A.sakin ? 'auto' : 'smooth', block: 'start' }); }
  async function adimSor(a, i, n) {
    var p = kok.querySelector('.sv-panel'), s = SEV[durum.lv], tekrarHak = kural('tekrar'), kullanildi = 0, ipucu = false;
    var soruGor = a.tip !== 'tekrar';
    p.innerHTML = '<div class="sv-adim-u"><span class="etiket"' + (durum.lv === 'kolay' ? '' : ' lang="en"') + '>' + esc((s.bolumler.filter(function (b) { return b[0] === a.b; })[0] || [0, ''])[1]) + ' · ' + (i + 1) + '/' + n + '</span><span class="sv-kayit" hidden>● kayıt</span></div>' +
      (a.tip === 'resim' ? '<div class="sv-resim"><svg viewBox="0 0 400 240" role="img" aria-label="Anlatılacak resim: ' + esc(a.resim.ad) + '">' + RESIM[a.resim.ciz] + '</svg></div>' : '') +
      (a.tip === 'kart' ? '<div class="sv-kart" lang="en"><b>' + esc(a.kart.kart) + '</b><span>You should say:</span><ul>' + a.kart.maddeler.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul></div>' : '') +
      '<p class="sv-soru" lang="en">' + (soruGor ? esc(a.soru) : '<span class="say">🔊 cümleyi dinle, sonra tekrarla</span>') + '</p>' +
      '<div class="sv-orta"><div class="sv-saat" style="--k:1"><b>–</b><small>hazır ol</small></div><div class="sv-sag"><div class="sv-dalga yok" aria-hidden="true">' + new Array(28).join('<i></i>') + '<i></i><span class="sv-dur">duraksama</span></div><div class="sv-canli" aria-live="off"></div></div></div>' +
      '<textarea class="sv-yaz" rows="3" lang="en" placeholder="' + (SR ? 'mikrofon yoksa buraya yaz…' : 'cevabını yaz…') + '"' + (SR && durum.mod === 'sinav' ? ' hidden' : '') + '></textarea>' +
      '<div class="ipucu-kutu" hidden></div>' +
      '<div class="alt-satir sv-dug">' + (kural('ipucu') && IPUCU[a.b] ? '<button type="button" class="btn sm acadia-btn" data-ipucu>Acadia ipucu</button>' : '') + (tekrarHak ? '<button type="button" class="btn sm" data-tk>Soruyu tekrar et</button>' : '') + '<button type="button" class="btn sm" data-cik>Çık</button><button type="button" class="btn sm ana" data-bitti disabled>Bitirdim</button></div>';
    goster(p);
    var cik = false; p.querySelector('[data-cik]').onclick = function () { cik = true; durum.iptal = true; if (sonlandir) sonlandir(); };
    var ib = p.querySelector('[data-ipucu]'); if (ib) ib.onclick = function () { ipucu = true; ib.disabled = true; var k = p.querySelector('.ipucu-kutu'); k.hidden = false; k.innerHTML = '<p><span class="el">Acadia:</span> ' + esc(IPUCU[a.b]) + '</p>'; h.fisilda(IPUCU[a.b]); };
    var tb = p.querySelector('[data-tk]'); if (tb) tb.onclick = function () { if (kullanildi >= tekrarHak) return; kullanildi++; h.soyle(a.soru, '', { hiz: s.hiz * .92, gizli: !soruGor }); if (kullanildi >= tekrarHak) tb.disabled = true; };
    /* hoca sorar */
    if (a.giris) await h.soyle(a.giris, kural('tr') ? a.giris_tr : '', { hiz: s.hiz });
    if (durum.iptal) return null;
    await h.soyle(a.tip === 'kart' ? 'Here is your topic. ' + a.soru : a.soru, '', { hiz: s.hiz, gizli: !soruGor });
    if (durum.iptal) return null;
    var sonlandir = null;
    /* hazırlık */
    if (a.hazirlik) {
      var notlar = a.tip === 'kart' ? '<textarea class="sv-not" rows="3" placeholder="notlar: yalnız anahtar kelimeler…"></textarea>' : '';
      if (notlar) p.querySelector('.sv-orta').insertAdjacentHTML('afterend', notlar);
      var bd = p.querySelector('[data-bitti]'); bd.disabled = false; bd.textContent = 'Hazırım';
      await new Promise(function (ok) {
        var t0 = Date.now(), iv = setInterval(function () { var k = a.hazirlik - (Date.now() - t0) / 1000; halka(p, k, a.hazirlik, 'hazırlık'); if (k <= 0) bitir(); }, 200);
        var bitir = function () { clearInterval(iv); sonlandir = null; ok(); }; sonlandir = bitir; bd.onclick = bitir;
      });
      if (durum.iptal) return null;
      if (a.tip === 'kart') await h.soyle('All right. Remember, you have one to two minutes. Please start speaking now.', '', { hiz: s.hiz });
    }
    if (durum.iptal) return null;
    /* konuşma */
    if (W.speechSynthesis) speechSynthesis.cancel();
    var canli = p.querySelector('.sv-canli'), yaz = p.querySelector('.sv-yaz'), kayitEl = p.querySelector('.sv-kayit'), bdug = p.querySelector('[data-bitti]');
    kok.classList.add('kayitta'); kayitEl.hidden = false; bdug.disabled = false; bdug.textContent = 'Bitirdim';
    var kayit = kaydet(), srYok = !SR, t0 = Date.now();
    var dinleyici = SR ? dinle(function (m) { if (m === null) { srYok = true; yaz.hidden = false; canli.textContent = 'Mikrofon izni yok; yazarak devam et.'; return; } canli.textContent = durum.mod === 'pratik' ? m : (m ? '• • • konuşuyorsun' : ''); }) : null;
    if (!dinleyici) { srYok = true; yaz.hidden = false; yaz.focus({ preventScroll: true }); }
    var olcer = seviyeOlcer(), dalga = p.querySelector('.sv-dalga'), cubuk = dalga.querySelectorAll('i'), saatEl = p.querySelector('.sv-saat');
    var sonSes = 0, ilkSes = 0, sessizBas = t0, duraks = 0, duraksSn = 0, kas = false, saatBakti = false, sonOnay = Date.now(), raf = 0, gecmis = [];
    if (olcer) dalga.classList.remove('yok');
    yaz.addEventListener('input', function () { sonSes = Date.now(); if (!ilkSes) ilkSes = sonSes; });
    var ciz = function () {
      var now = Date.now(), lvl = olcer ? olcer.oku() : 0;
      if (olcer) {
        gecmis.push(lvl); if (gecmis.length > cubuk.length) gecmis.shift();
        for (var j = 0; j < cubuk.length; j++) cubuk[j].style.setProperty('--h', (gecmis[gecmis.length - cubuk.length + j] || 0).toFixed(3));
        saatEl.style.setProperty('--ses', lvl.toFixed(3));
        if (lvl > SESSIZ) { if (!ilkSes) ilkSes = now; if (now - sessizBas > DURAKSAMA * 1000 && sonSes) { duraks++; duraksSn += (now - sessizBas) / 1000; } sonSes = now; sessizBas = now; }
      } else if (now - sonSes < 400) sessizBas = now;
      var sessiz = (now - Math.max(sonSes, t0)) / 1000;
      dalga.classList.toggle('duruyor', sessiz > DURAKSAMA && (sonSes > 0 || sessiz > 4));
      dinleyenHoca(now, sessiz);
      raf = requestAnimationFrame(ciz);
    };
    var dinleyenHoca = function (now, sessiz) {   /* konuşurken başını sallar, not alır; uzun sessizlikte kaşını kaldırır; süre azalınca saate bakar */
      if (A.sakin) return;
      var kalan = a.sure - (now - t0) / 1000;
      if (!saatBakti && kalan < a.sure * .2 && kalan > 1) { saatBakti = true; h.svg.dataset.bak = 'saat'; setTimeout(function () { if (h.svg.dataset.bak === 'saat') delete h.svg.dataset.bak; }, 1400); }
      if (sessiz > 4 && !kas) { kas = true; h.ifade('kas'); }
      else if (sessiz < 1 && kas) { kas = false; h.ifade('normal'); }
      if (sessiz < 1 && now - sonOnay > 3200 + Math.random() * 2600) {
        sonOnay = now; h.svg.classList.remove('onay'); void h.svg.getBoundingClientRect(); h.svg.classList.add('onay');
        if (durum.mod === 'sinav' && Math.random() < .5) { h.kol('tikla'); setTimeout(function () { h.kol('masa'); }, 1500); }
      }
    };
    raf = requestAnimationFrame(ciz);
    await new Promise(function (ok) {
      var iv = setInterval(function () { var k = a.sure - (Date.now() - t0) / 1000; halka(p, k, a.sure, 'konuşma'); if (k <= 0) bitir(); }, 200);
      var bitir = function () { clearInterval(iv); sonlandir = null; ok(); }; sonlandir = bitir; bdug.onclick = bitir;
    });
    cancelAnimationFrame(raf); if (olcer) olcer.kapat(); h.svg.classList.remove('onay'); delete h.svg.dataset.bak; if (kas) h.ifade('normal'); h.kol('masa');
    var sn = (Date.now() - t0) / 1000; bdug.disabled = true; kok.classList.remove('kayitta'); kayitEl.hidden = true;
    var sonuc = dinleyici ? await dinleyici.dur() : { metin: '', guven: 0 };
    var ses = await kayit.dur();
    var metin = (sonuc.metin || '').trim(); if ((!metin || srYok) && yaz.value.trim()) metin = yaz.value.trim();
    if (a.tip === 'kart' && a.sure && sn >= a.sure - .5) await h.soyle('Thank you.', '', { hiz: s.hiz });
    if (cik) return null;
    return { adim: a, metin: metin, sn: sn, ses: ses, guven: sonuc.guven, ipucu: ipucu, gecikme: ilkSes ? (ilkSes - t0) / 1000 : null, duraks: olcer ? duraks : null };
  }

  async function baslat() {
    if (durum.calisiyor) return;
    durum.calisiyor = true; durum.iptal = false; kok.classList.add('calisiyor'); D.body.classList.toggle('sinavda', durum.mod === 'sinav');
    h.svg.classList.toggle('gozetmen', durum.mod === 'sinav');
    kok.querySelector('.sv-rapor').innerHTML = '';
    var p = kok.querySelector('.sv-panel'); p.innerHTML = '<p class="el" style="font-size:22px">Defne Hoca soruları hazırlıyor…</p>';
    if (SR || W.MediaRecorder) await mikrofon();
    var plan = await planKur(durum.lv, durum.mod, durum.mod === 'pratik' ? durum.tek : null), cevaplar = [];
    if (durum.mod === 'sinav') await perde('giris');
    for (var i = 0; i < plan.length && !durum.iptal; i++) {
      var c = await adimSor(plan[i], i, plan.length); if (!c) break;
      c.olcum = olc(c, c.adim); cevaplar.push(c);
      if (durum.mod === 'pratik' && !durum.iptal) { var devam = await pratikGeri(c, i + 1 < plan.length); if (devam === 'tekrar') { cevaplar.pop(); i--; } else if (devam === 'dur') break; }
    }
    durum.calisiyor = false; kok.classList.remove('calisiyor', 'kayitta'); D.body.classList.remove('sinavda');
    if (!cevaplar.length) { secimCiz(); karsila(); return; }
    if (durum.mod === 'sinav' && !durum.iptal) await perde('cikis');
    await rapor(cevaplar);
    secimCiz(); gelisimCiz(true);
  }
  /* sınav giriş ve çıkış sahnesi */
  function perde(tur) {
    var oda = kok.querySelector('.sv-oda'), el = D.createElement('div');
    el.className = 'sv-perde ' + tur; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = tur === 'giris' ? '<span class="damga">sınav başladı</span><small>' + esc(SEV[durum.lv].tarz) + ' · ' + new Date().toLocaleTimeString('tr', { hour: '2-digit', minute: '2-digit' }) + '</small>'
      : '<div class="zarf"><i class="k1"></i><i class="k2"></i><i class="k3"></i><span class="kapak2"></span><span class="govde2"></span></div><small>Süre doldu · kâğıtlar toplanıyor</small>';
    oda.appendChild(el);
    if (tur === 'cikis') { h.kol('tikla'); h.soyle('Time is up. Please stop there. Thank you.', kural('tr') ? 'Süre doldu; teşekkürler.' : '', { hiz: SEV[durum.lv].hiz }); }
    else if (A.sesCal) A.sesCal('tebesir');
    return bekle(A.sakin ? 400 : tur === 'giris' ? 1700 : 2300).then(function () { el.classList.add('git'); h.kol('masa'); return bekle(A.sakin ? 0 : 350); }).then(function () { el.remove(); });
  }
  function pratikGeri(c, sonrakiVar) {
    var p = kok.querySelector('.sv-panel'), o = c.olcum, g = o.gram[0];
    var r = o.kelime < 5 ? 'yanlis' : (o.gram.length || o.doluluk < .5 || (c.adim.tip === 'tekrar' && o.isabet < .9)) ? 'kismen' : 'dogru';
    h.tepki(r);
    var not = c.adim.tip === 'tekrar' ? (o.isabet === 1 ? 'Cümleyi eksiksiz tekrarladın.' : 'Kaçan kelimeler: ' + o.kacan.join(', ')) : o.kelime < 5 ? 'Çok kısa kaldı; bir neden ve bir örnek ekle.' : g ? g.tr + ' (' + g.parca + ' → ' + g.oneri + ')' : o.doluluk < .5 ? 'Süreyi daha iyi kullan; cevabı bir örnekle uzat.' : 'Akıcı ve yeterince uzun bir cevap.';
    p.innerHTML = '<span class="etiket">geri bildirim</span><p class="sv-metin" lang="en">' + (c.metin ? renkle(c.metin, o.gram) : '<span class="say">(cevap algılanmadı)</span>') + '</p>' +
      (c.adim.tip === 'tekrar' ? '<p class="say" lang="en">Hedef: ' + esc(c.adim.hedef) + '</p>' : '') +
      '<div class="sv-cip">' + cipler(c) + '</div><div class="geri acik hoca-geri ' + r + '">' + esc(not) + '</div>' + (c.ses ? '<audio controls src="' + c.ses + '"></audio>' : '') +
      '<div class="alt-satir"><button type="button" class="btn sm" data-g="dur">Bitir ve rapor</button><button type="button" class="btn sm" data-g="tekrar">Tekrar dene</button>' + (sonrakiVar ? '<button type="button" class="btn sm ana" data-g="devam">Sonraki</button>' : '<button type="button" class="btn sm ana" data-g="dur">Raporu gör</button>') + '</div>';
    goster(p);
    h.soyle(r === 'dogru' ? 'Good answer.' : r === 'kismen' ? 'Not bad. Look at my note.' : 'Try to say a bit more.', kural('tr') ? not : '');
    return new Promise(function (ok) { p.querySelectorAll('[data-g]').forEach(function (b) { b.onclick = function () { ok(b.dataset.g); }; }); });
  }
  function cipler(c) {
    var o = c.olcum;
    return (c.adim.tip === 'tekrar' ? '<span>%' + Math.round(o.isabet * 100) + ' doğru</span>' : '<span>' + o.sn + ' sn</span><span>' + o.kelime + ' kelime</span><span>' + (o.sn > 4 ? o.wpm + ' kelime/dk' : '–') + '</span>' + (o.dolgu ? '<span>“um” × ' + o.dolgu + '</span>' : '') + (o.gram.length ? '<span>' + o.gram.length + ' düzeltme</span>' : '') + (c.gecikme != null && c.gecikme >= 3 ? '<span>ilk söz ' + Math.round(c.gecikme) + ' sn</span>' : '') + (c.duraks ? '<span>uzun duraksama × ' + c.duraks + '</span>' : '') + (c.ipucu ? '<span>ipucu alındı</span>' : ''));
  }

  async function rapor(cevaplar) {
    var lv = durum.lv, s = SEV[lv], O = OLCEK[lv], yer = kok.querySelector('.sv-rapor');
    var p = kok.querySelector('.sv-panel'); p.innerHTML = '<p class="el" style="font-size:22px">Defne Hoca değerlendiriyor…</p>'; h.dusun(true);
    var x = kriterYerel(lv, cevaplar), k = {}, ai = null;
    ai = await A.yz('sinav', { seviye: lv, mod: durum.mod, cevaplar: cevaplar.map(function (c) { return { bolum: c.adim.b, soru: c.adim.tip === 'tekrar' ? 'REPEAT: ' + c.adim.hedef : c.adim.soru, cevap: String(c.metin || '').slice(0, 1500), sn: Math.round(c.sn) }; }) }, 30000);
    h.dusun(false);
    s.kriter.forEach(function (kr) {
      var yerel = O.cevir(x[kr[0]] || 0), y = ai && ai.kriterler ? +ai.kriterler[kr[0]] : NaN;
      k[kr[0]] = isFinite(y) && y >= 0 && y <= O.max ? Math.round((y * .7 + yerel * .3) * (lv === 'kolay' ? 1 : 2)) / (lv === 'kolay' ? 1 : 2) : yerel;
    });
    if (lv === 'zor' && !cevaplar.some(function (c) { return c.adim.tip === 'tekrar'; })) delete k.tekrar;
    if (lv === 'zor' && !cevaplar.some(function (c) { return c.adim.tip !== 'tekrar'; })) { delete k.akici; delete k.kelime; }
    var genel = O.genel(k), gecti = lv === 'kolay' ? genel >= 12 : null;
    var duz = ai && Array.isArray(ai.duzeltmeler) && ai.duzeltmeler.length ? ai.duzeltmeler.slice(0, 6) : duzeltmeYerel(cevaplar);
    var zayif = Object.keys(k).sort(function (a, b) { return k[a] - k[b]; })[0], ad = function (id) { return (s.kriter.filter(function (q) { return q[0] === id; })[0] || [0, id])[1]; };
    var ozet = ai && ai.ozet_tr ? String(ai.ozet_tr) : 'En güçlü yanın: ' + ad(Object.keys(k).sort(function (a, b) { return k[b] - k[a]; })[0]) + '. Önce şuna çalış: ' + ad(zayif) + '.';
    var g = A.ls.al('spGecmis', []); g.push({ t: Date.now(), lv: lv, mod: durum.mod, genel: genel, k: k, kismi: durum.mod === 'pratik' }); A.ls.yaz('spGecmis', g.slice(-60));
    A.gunlukEkle('speaking');
    var max = lv === 'kolay' ? O.max : O.max;
    yer.innerHTML = '<div class="kagit sv-rapor-kart' + (A.sakin ? '' : ' zarftan') + '"><div class="rp-ust"><div><span class="etiket">Acadex sınav raporu · ' + esc(s.tarz) + ' · ' + (durum.mod === 'pratik' ? 'pratik' : 'tam sınav') + '</span><h3>Tahmini sonuç</h3><p class="say">Bu bir resmî sınav sonucu değildir; konuşmandan yapılan tahmindir' + (ai ? ' (ölçüm + yapay zekâ)' : ' (yerel ölçüm)') + '.</p></div>' +
      '<div class="rp-genel"><b data-sayac="' + genel + '">' + O.yaz(A.sakin ? genel : 0) + '</b><small>' + (lv === 'kolay' ? '/ 20' : lv === 'orta' ? 'band' : '/ 6') + '</small>' + (gecti !== null ? '<span class="damga ' + (gecti ? 'gecti' : 'kaldi') + '">' + (gecti ? 'geçti' : 'kaldı') + '</span>' : '') + '</div></div>' +
      '<div class="rp-kriter">' + Object.keys(k).map(function (id, i) { return '<div class="kb" style="--d:' + (.5 + i * .18).toFixed(2) + 's"><span>' + esc(ad(id)) + '</span><i style="--w:' + Math.round(k[id] / max * 100) + '%"></i><b>' + O.yaz(k[id]) + '</b></div>'; }).join('') + '</div>' +
      '<p class="rp-ozet"><span class="el">Defne Hoca:</span> ' + esc(ozet) + '</p>' +
      (duz.length ? '<h4>Kendi cümlelerinden</h4><ul class="rp-duz">' + duz.map(function (d) { return '<li><span class="eski" lang="en">' + esc(d.orijinal) + '</span>' + (d.daha_iyi ? '<span class="yeni" lang="en">→ ' + esc(d.daha_iyi) + '</span>' : '') + '<small>' + esc(d.not_tr) + '</small></li>'; }).join('') + '</ul>' : '') +
      '<div class="alt-satir rp-cevap-u"><h4>Cevapların</h4>' + RENK_ANAHTAR + '</div><ol class="rp-cevap">' + cevaplar.map(function (c, i) {
        var isaret = c.olcum.gram.concat(duz.filter(function (d) { return d.orijinal && String(d.orijinal).length < 60; }).map(function (d) { return { parca: d.orijinal, tr: d.not_tr, oneri: d.daha_iyi }; }));
        return '<li data-i="' + i + '"><p class="soru" lang="en">' + esc(c.adim.tip === 'tekrar' ? c.adim.hedef : c.adim.soru) + '</p><p class="metin" lang="en">' + (c.metin ? renkle(c.metin, isaret) : '<span class="say">(algılanmadı)</span>') + '</p><div class="sv-cip">' + cipler(c) + '</div>' +
          '<div class="rp-ara">' + (c.ses ? '<audio controls preload="none" src="' + c.ses + '"></audio>' : '') + (c.adim.tip !== 'tekrar' ? '<button type="button" class="btn sm" data-model aria-expanded="false">Model cevapla karşılaştır</button>' : '') + '</div><div class="rp-model" hidden></div></li>'; }).join('') + '</ol>' +
      '<div class="alt-satir"><span class="say">Ses kayıtları yalnız bu sekmede durur; sayfayı kapatınca silinir.</span><button type="button" class="btn sm ana" data-yeni>Yeni ' + (durum.mod === 'sinav' ? 'sınav' : 'pratik') + '</button></div></div>';
    yer.querySelector('[data-yeni]').onclick = function () { kok.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    yer.querySelectorAll('[data-model]').forEach(function (b) { b.onclick = function () { var li = b.closest('li'); modelAc(li, cevaplar[+li.dataset.i], lv); }; });
    sayacCalis(yer.querySelector('[data-sayac]'), genel, O, gecti);
    yer.scrollIntoView({ behavior: A.sakin ? 'auto' : 'smooth', block: 'start' });
    var iyi = lv === 'kolay' ? genel >= 15 : lv === 'orta' ? genel >= 7 : genel >= 5;
    h.tepki(iyi ? 'dogru' : genel >= (lv === 'kolay' ? 12 : lv === 'orta' ? 5.5 : 3.5) ? 'kismen' : 'yanlis');
    await h.soyle(iyi ? 'Well done. That was a strong performance.' : 'Thank you. Look at the report; we will improve it together.', kural('tr') ? ozet : '');
    if (durum.mod === 'sinav' && A.bitir) { var hb = A.ls.al('hoca', {}); if (!hb.speaking) { hb.speaking = Date.now(); A.ls.yaz('hoca', hb); } }
  }

  /* rapor sinematiği: puan sayaç gibi yükselir, damga sonunda vurulur */
  function sayacCalis(el, hedef, O, gecti) {
    if (!el) return;
    if (A.sakin) { el.textContent = O.yaz(hedef); return; }
    var t0 = 0, sure = 1300;
    var adim = function (t) { if (!t0) t0 = t; var x = Math.min(1, (t - t0) / sure), e = 1 - Math.pow(1 - x, 3), v = hedef * e; el.textContent = O.yaz(O.gmax === 20 ? Math.round(v) : Math.round(v * 2) / 2); if (x < 1) requestAnimationFrame(adim); else { el.classList.add('vurdu'); if (A.sesCal) A.sesCal(gecti === false ? 'kismen' : 'dogru'); if (gecti && A.sevin) A.sevin(); } };
    setTimeout(function () { requestAnimationFrame(adim); }, 350);
  }

  /* ---------- gelişim grafiği ---------- */
  function gelisimCiz(yeni) {
    var el = kok.querySelector('.sv-gelisim'), lv = durum.lv, s = SEV[lv], O = OLCEK[lv];
    var g = A.ls.al('spGecmis', []).filter(function (x) { return x.lv === lv; }).slice(-10);
    if (!g.length) { el.innerHTML = '<span class="etiket">gelişim · ' + esc(s.ad) + '</span><p class="say" style="margin:6px 0 0">İlk denemenden sonra puanların burada çizilecek.</p>'; return; }
    var Wd = 560, Hd = 150, pad = 26, gm = O.gmax, xs = function (i) { return pad + (g.length < 2 ? (Wd - 2 * pad) / 2 : i * (Wd - 2 * pad) / (g.length - 1)); }, ys = function (v) { return Hd - pad - v / gm * (Hd - 2 * pad); };
    var sinavlar = g.filter(function (x) { return !x.kismi; }), yol = g.map(function (x, i) { return (i ? 'L' : 'M') + xs(i).toFixed(1) + ' ' + ys(x.genel).toFixed(1); }).join(' ');
    var son3 = g.slice(-3), ort = {}; son3.forEach(function (x) { Object.keys(x.k || {}).forEach(function (a) { ort[a] = (ort[a] || 0) + x.k[a] / son3.length; }); });
    var zayif = Object.keys(ort).sort(function (a, b) { return ort[a] - ort[b]; })[0], zad = zayif ? (s.kriter.filter(function (q) { return q[0] === zayif; })[0] || [0, zayif])[1] : '';
    var esik = lv === 'kolay' ? 15 : lv === 'orta' ? 7 : 5, sonIki = sinavlar.slice(-2), hazir = sonIki.length === 2 && sonIki.every(function (x) { return x.genel >= esik; });
    el.classList.toggle('ciz', !!yeni && !A.sakin);
    el.innerHTML = '<div class="alt-satir" style="margin:0 0 6px"><span class="etiket">gelişim · ' + esc(s.ad) + ' · son ' + g.length + ' deneme</span><span class="say">● sınav ○ pratik</span></div>' +
      '<svg class="sv-grafik" viewBox="0 0 ' + Wd + ' ' + Hd + '" role="img" aria-label="Puan geçmişi">' + [0, .5, 1].map(function (f) { var y = ys(gm * f); return '<path d="M' + pad + ' ' + y + ' H' + (Wd - pad) + '" stroke="var(--cizgi)" stroke-dasharray="4 5"/><text x="4" y="' + (y + 4) + '" font-size="11" fill="var(--ink3)">' + O.yaz(gm * f).replace('.0', '') + '</text>'; }).join('') +
      '<path class="sv-cizgi" pathLength="1" d="' + yol + '" fill="none" stroke="var(--sv)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' + g.map(function (x, i) { return '<circle style="--d:' + (i / Math.max(1, g.length - 1) * 1.1).toFixed(2) + 's" cx="' + xs(i) + '" cy="' + ys(x.genel) + '" r="6" fill="' + (x.kismi ? '#fff' : 'var(--sv)') + '" stroke="var(--ink)" stroke-width="2"><title>' + new Date(x.t).toLocaleDateString('tr') + ' · ' + O.yaz(x.genel) + (x.kismi ? ' (pratik)' : '') + '</title></circle>'; }).join('') + '</svg>' +
      '<p class="say" style="margin:6px 0 0">' + (zad ? 'Son denemelerde en zayıf kriter: <b>' + esc(zad) + '</b>. ' : '') + (hazir ? (lv === 'zor' ? 'Son iki sınavın çok iyi; bu seviyede ustalaştın.' : 'Son iki sınavın eşiği geçti; <b>' + esc(SEV[lv === 'kolay' ? 'orta' : 'zor'].ad) + '</b> seviyesine hazırsın.') : '') + '</p>';
  }

  W.SINAV = { kur: kur, renkle: renkle, eksikler: eksikler, ISKELET: ISKELET, SEV: SEV, olc: olc, kriterYerel: kriterYerel, OLCEK: OLCEK, planKur: planKur, sayfaUyarla: sayfaUyarla, duzeltmeYerel: duzeltmeYerel };
})();
